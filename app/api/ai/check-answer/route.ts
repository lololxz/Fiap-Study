import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkAndGrantAchievements, getStreakStatus } from '@/lib/achievements';
import { getLevelFromXp } from '@/lib/utils';
import { requireUser, unauthorized, badRequest, notFound, serverError, startOfDay } from '@/lib/api';
import { initialReviewState, scheduleNext } from '@/lib/srs';

const schema = z.object({
  questionId: z.string().min(1),
  userAnswer: z.string().max(8),
  timeSpent: z.number().int().min(0).max(3600).default(0),
});

/** Linhas antigas podem ter JSON inválido; não deixa isso derrubar a resposta. */
function safeParseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth) return unauthorized();
  const userId = auth.userId;

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest('Dados inválidos', parsed.error.errors);

    const { questionId, userAnswer, timeSpent } = parsed.data;

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) return notFound('Questão não encontrada');

    // subject/topic/difficulty vêm do registro, não do cliente: antes dava para
    // forjar MATH_MASTER mandando subject: 'matematica' em qualquer questão.
    const { subject, topic, difficulty } = question;

    const isCorrect = userAnswer.toUpperCase() === question.answer.toUpperCase();

    // XP só na primeira vez que a questão é acertada — reenviar a mesma questão
    // não farma mais XP.
    const answeredCorrectlyBefore = isCorrect
      ? await prisma.userQuestionHistory.findFirst({
          where: { userId, questionId, isCorrect: true },
          select: { id: true },
        })
      : null;

    const xpGained = isCorrect && !answeredCorrectlyBefore ? 10 : 2;

    await prisma.userQuestionHistory.create({
      data: {
        userId,
        questionId,
        userAnswer,
        isCorrect,
        timeSpent,
        subject,
        topic,
        difficulty,
        needsReview: !isCorrect,
      },
    });

    // Performance — lê antes para conseguir atualizar avgTimeSpent, que antes
    // nunca era escrito.
    const existingPerf = await prisma.performance.findUnique({
      where: { userId_subject_topic: { userId, subject, topic } },
    });

    const prevTotal = existingPerf?.totalQuestions ?? 0;
    const newTotal = prevTotal + 1;
    const newAvg = ((existingPerf?.avgTimeSpent ?? 0) * prevTotal + timeSpent) / newTotal;

    await prisma.performance.upsert({
      where: { userId_subject_topic: { userId, subject, topic } },
      update: {
        totalQuestions: newTotal,
        correctAnswers: (existingPerf?.correctAnswers ?? 0) + (isCorrect ? 1 : 0),
        wrongAnswers: (existingPerf?.wrongAnswers ?? 0) + (isCorrect ? 0 : 1),
        avgTimeSpent: newAvg,
        lastPracticed: new Date(),
      },
      create: {
        userId,
        subject,
        topic,
        totalQuestions: 1,
        correctAnswers: isCorrect ? 1 : 0,
        wrongAnswers: isCorrect ? 0 : 1,
        avgTimeSpent: timeSpent,
      },
    });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: xpGained } },
      select: { xp: true, streak: true, bestStreak: true },
    });

    const streakStatus = await getStreakStatus(userId);
    if (streakStatus.shouldIncrement) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          streak: streakStatus.streak,
          bestStreak: streakStatus.bestStreak,
          lastStudyDate: new Date(),
        },
      });
    }

    // ---- Revisão espaçada ----
    const existingReview = await prisma.reviewItem.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });

    const previousState = existingReview
      ? {
          intervalDays: existingReview.intervalDays,
          ease: existingReview.ease,
          repetitions: existingReview.repetitions,
          lapses: existingReview.lapses,
        }
      : initialReviewState();

    const schedule = scheduleNext(previousState, isCorrect);

    await prisma.reviewItem.upsert({
      where: { userId_questionId: { userId, questionId } },
      update: {
        dueAt: schedule.dueAt,
        intervalDays: schedule.intervalDays,
        ease: schedule.ease,
        repetitions: schedule.repetitions,
        lapses: schedule.lapses,
        lastReviewedAt: new Date(),
      },
      create: {
        userId,
        questionId,
        dueAt: schedule.dueAt,
        intervalDays: schedule.intervalDays,
        ease: schedule.ease,
        repetitions: schedule.repetitions,
        lapses: schedule.lapses,
        lastReviewedAt: new Date(),
      },
    });

    // ---- Conquistas ----
    const [totalQuestions, totalCorrect, mathCorrect, portugueseCorrect, reviewCount, recent, todayCount, bySubject] =
      await Promise.all([
        prisma.userQuestionHistory.count({ where: { userId } }),
        prisma.userQuestionHistory.count({ where: { userId, isCorrect: true } }),
        prisma.userQuestionHistory.count({ where: { userId, isCorrect: true, subject: 'matematica' } }),
        prisma.userQuestionHistory.count({ where: { userId, isCorrect: true, subject: 'portugues' } }),
        prisma.reviewItem.count({ where: { userId, repetitions: { gte: 2 } } }),
        prisma.userQuestionHistory.findMany({
          where: { userId },
          orderBy: { answeredAt: 'desc' },
          take: 10,
          select: { isCorrect: true },
        }),
        prisma.userQuestionHistory.count({
          where: { userId, answeredAt: { gte: startOfDay() } },
        }),
        prisma.performance.groupBy({
          by: ['subject'],
          where: { userId },
          _sum: { totalQuestions: true, correctAnswers: true },
        }),
      ]);

    let consecutive = 0;
    for (const h of recent) {
      if (!h.isCorrect) break;
      consecutive += 1;
    }

    const dailyGoal = await prisma.user.findUnique({
      where: { id: userId },
      select: { dailyGoal: true },
    });

    // Exige volume mínimo para a conquista não cair com 1 acerto de 1.
    const highAccuracy = bySubject.some((s) => {
      const total = s._sum.totalQuestions ?? 0;
      const correct = s._sum.correctAnswers ?? 0;
      return total >= 20 && correct / total >= 0.8;
    });

    const newLevel = getLevelFromXp(updatedUser.xp);

    const granted = await checkAndGrantAchievements({
      userId,
      totalQuestions,
      totalCorrect,
      streak: streakStatus.streak,
      level: newLevel,
      consecutiveCorrect: consecutive,
      mathCorrect,
      portugueseCorrect,
      consolidatedReviews: reviewCount,
      highAccuracy,
      repeatReview: existingReview !== null,
      firstErrorReview: (existingReview?.lapses ?? 0) >= 1,
      dailyGoalMet: todayCount >= (dailyGoal?.dailyGoal ?? 10),
    });

    return NextResponse.json({
      isCorrect,
      correctAnswer: question.answer,
      explanation: question.explanation,
      stepByStep: safeParseArray(question.stepByStep),
      xpGained,
      newXp: updatedUser.xp,
      newLevel,
      newStreak: streakStatus.streak,
      nextReview: schedule.label,
      nextReviewAt: schedule.dueAt,
      todayCount,
      dailyGoal: dailyGoal?.dailyGoal ?? 10,
      grantedAchievements: granted,
    });
  } catch (error) {
    return serverError('Erro ao verificar resposta', error);
  }
}
