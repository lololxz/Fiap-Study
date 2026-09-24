import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateQuestionBatch, type GeneratedQuestion } from '@/lib/ai/question-generator';
import { checkAndGrantAchievements, getStreakStatus } from '@/lib/achievements';
import { getLevelFromXp } from '@/lib/utils';
import { requireUser, unauthorized, badRequest, notFound, serverError, startOfDay } from '@/lib/api';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { initialReviewState, scheduleNext } from '@/lib/srs';

// A geração faz N chamadas de IA com concorrência limitada.
export const maxDuration = 60;

const TOPICS: Record<string, string[]> = {
  matematica: [
    'porcentagem',
    'regra-tres-simples',
    'regra-tres-composta',
    'media-aritmetica',
    'problemas-matematicos',
    'raciocinio-logico',
  ],
  portugues: [
    'interpretacao-texto',
    'ortografia',
    'pontuacao',
    'verbos',
    'substantivos',
    'sinonimos-antonimos',
  ],
};

const createSchema = z.object({
  title: z.string().max(120).default('Simulado'),
  subjects: z.array(z.enum(['matematica', 'portugues'])).min(1).max(2),
  difficulty: z.enum(['easy', 'medium', 'hard', 'challenge', 'mixed']),
  totalQuestions: z.number().int().min(5).max(30),
  timeLimit: z.number().int().min(0).max(4 * 60 * 60).default(0),
});

const finishSchema = z.object({
  simuladoId: z.string().min(1),
  answers: z.record(z.string().max(8)),
  timeUsed: z.number().int().min(0).max(4 * 60 * 60).default(0),
});

export async function POST(req: NextRequest) {
  const action = new URL(req.url).searchParams.get('action');
  if (action === 'finish') return finishSimulado(req);
  return createSimulado(req);
}

async function createSimulado(req: NextRequest) {
  const auth = await requireUser();
  if (!auth) return unauthorized();
  const userId = auth.userId;

  const limited = rateLimit(`simulado:${userId}`, LIMITS.simulado);
  if (!limited.ok) {
    return NextResponse.json(rateLimitResponse(limited.retryAfterSeconds), { status: 429 });
  }

  let simuladoId: string | null = null;

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest('Dados inválidos', parsed.error.errors);

    const { title, subjects, difficulty, totalQuestions, timeLimit } = parsed.data;

    // A linha é criada ANTES de gerar: antes ela só nascia no fim, então um
    // request abortado deixava questões órfãs no banco sem simulado nenhum.
    const simulado = await prisma.simulado.create({
      data: {
        userId,
        title,
        subjects: JSON.stringify(subjects),
        difficulty,
        totalQuestions: 0,
        timeLimit,
        status: 'generating',
        questions: '[]',
      },
    });
    simuladoId = simulado.id;

    // Distribui as questões entre as matérias, variando o tópico.
    const requests: Array<{ subject: string; topic: string; difficulty: string }> = [];
    const perSubject = Math.ceil(totalQuestions / subjects.length);

    for (const subject of subjects) {
      const topics = TOPICS[subject] ?? ['geral'];
      for (let i = 0; i < perSubject && requests.length < totalQuestions; i += 1) {
        requests.push({
          subject,
          topic: topics[i % topics.length],
          difficulty:
            difficulty === 'mixed'
              ? (['easy', 'medium', 'medium', 'hard'] as const)[Math.floor(Math.random() * 4)]
              : difficulty,
        });
      }
    }

    const generated = await generateQuestionBatch(requests, 4);

    const usable: Array<GeneratedQuestion & { id: string }> = [];

    // Escritas no SQLite em série: paralelizar aqui só gera "database is locked".
    for (const question of generated) {
      if (!question) continue;
      const saved = await prisma.question.upsert({
        where: { hash: question.hash! },
        update: {},
        create: {
          hash: question.hash!,
          subject: question.subject,
          topic: question.topic,
          difficulty: question.difficulty,
          question: question.question,
          options: JSON.stringify(question.options),
          answer: question.answer,
          explanation: question.explanation,
          stepByStep: JSON.stringify(question.stepByStep),
        },
      });
      usable.push({ ...question, id: saved.id });
    }

    if (usable.length === 0) {
      await prisma.simulado.update({
        where: { id: simuladoId },
        data: { status: 'failed' },
      });
      return NextResponse.json(
        { error: 'Não foi possível gerar as questões. Tente novamente em instantes.' },
        { status: 502 },
      );
    }

    await prisma.simulado.update({
      where: { id: simuladoId },
      data: {
        status: 'active',
        totalQuestions: usable.length,
        questions: JSON.stringify(usable),
      },
    });

    return NextResponse.json({
      simuladoId,
      // `answer`, `explanation` e `stepByStep` ficam no banco até a finalização.
      questions: usable.map((q) => ({
        id: q.id,
        subject: q.subject,
        topic: q.topic,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
      })),
      timeLimit,
      requested: totalQuestions,
      generated: usable.length,
      // A UI avisa o aluno quando saiu menos do que ele pediu.
      partial: usable.length < totalQuestions,
    });
  } catch (error) {
    if (simuladoId) {
      // Não deixa a linha presa em 'generating'.
      await prisma.simulado
        .update({ where: { id: simuladoId }, data: { status: 'failed' } })
        .catch(() => undefined);
    }
    return serverError('Erro ao criar simulado', error);
  }
}

async function finishSimulado(req: NextRequest) {
  const auth = await requireUser();
  if (!auth) return unauthorized();
  const userId = auth.userId;

  try {
    const parsed = finishSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest('Dados inválidos', parsed.error.errors);

    const { simuladoId, answers, timeUsed } = parsed.data;

    const simulado = await prisma.simulado.findFirst({ where: { id: simuladoId, userId } });
    if (!simulado) return notFound('Simulado não encontrado');
    if (simulado.status === 'finished') {
      return NextResponse.json({ error: 'Este simulado já foi finalizado.' }, { status: 409 });
    }

    let questions: Array<GeneratedQuestion & { id: string }> = [];
    try {
      questions = JSON.parse(simulado.questions);
    } catch {
      return serverError('Simulado corrompido');
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Simulado sem questões.' }, { status: 409 });
    }

    const results = questions.map((q) => {
      const userAnswer = answers[q.id] ?? '';
      const isCorrect = userAnswer.toUpperCase() === String(q.answer).toUpperCase();
      return {
        questionId: q.id,
        subject: q.subject,
        topic: q.topic,
        question: q.question,
        options: q.options,
        userAnswer,
        correctAnswer: q.answer,
        isCorrect,
        explanation: q.explanation,
        stepByStep: q.stepByStep,
      };
    });

    const correct = results.filter((r) => r.isCorrect).length;
    const score = (correct / results.length) * 100;
    const perQuestionTime = Math.round(timeUsed / results.length);

    // Respostas do simulado passam a contar para o histórico, o desempenho e a
    // revisão espaçada — antes o simulado não alimentava nada disso.
    const existingCorrect = await prisma.userQuestionHistory.findMany({
      where: { userId, questionId: { in: results.map((r) => r.questionId) }, isCorrect: true },
      select: { questionId: true },
    });
    const alreadyCorrect = new Set(existingCorrect.map((h) => h.questionId));

    const xpGained = results.reduce((sum, r) => {
      if (!r.isCorrect) return sum + 2;
      return sum + (alreadyCorrect.has(r.questionId) ? 2 : 10);
    }, 0);

    const reviewStates = await prisma.reviewItem.findMany({
      where: { userId, questionId: { in: results.map((r) => r.questionId) } },
    });
    const reviewByQuestion = new Map(reviewStates.map((r) => [r.questionId, r]));

    await prisma.$transaction(
      async (tx) => {
        await tx.userQuestionHistory.createMany({
          data: results.map((r) => ({
            userId,
            questionId: r.questionId,
            userAnswer: r.userAnswer,
            isCorrect: r.isCorrect,
            timeSpent: perQuestionTime,
            subject: r.subject,
            topic: r.topic,
            difficulty: questions.find((q) => q.id === r.questionId)?.difficulty ?? 'medium',
            needsReview: !r.isCorrect,
          })),
        });

        await tx.simulado.update({
          where: { id: simuladoId },
          data: {
            correctAnswers: correct,
            wrongAnswers: results.length - correct,
            score,
            timeUsed,
            status: 'finished',
            finishedAt: new Date(),
          },
        });

        // Desempenho por matéria/tópico presente neste simulado.
        const groups = new Map<string, { subject: string; topic: string; total: number; correct: number }>();
        for (const r of results) {
          const key = `${r.subject}|${r.topic}`;
          const entry = groups.get(key) ?? { subject: r.subject, topic: r.topic, total: 0, correct: 0 };
          entry.total += 1;
          if (r.isCorrect) entry.correct += 1;
          groups.set(key, entry);
        }

        for (const group of groups.values()) {
          const existing = await tx.performance.findUnique({
            where: {
              userId_subject_topic: {
                userId,
                subject: group.subject,
                topic: group.topic,
              },
            },
          });

          const prevTotal = existing?.totalQuestions ?? 0;
          const newTotal = prevTotal + group.total;

          await tx.performance.upsert({
            where: {
              userId_subject_topic: {
                userId,
                subject: group.subject,
                topic: group.topic,
              },
            },
            update: {
              totalQuestions: newTotal,
              correctAnswers: (existing?.correctAnswers ?? 0) + group.correct,
              wrongAnswers: (existing?.wrongAnswers ?? 0) + (group.total - group.correct),
              avgTimeSpent:
                ((existing?.avgTimeSpent ?? 0) * prevTotal + perQuestionTime * group.total) / newTotal,
              lastPracticed: new Date(),
            },
            create: {
              userId,
              subject: group.subject,
              topic: group.topic,
              totalQuestions: group.total,
              correctAnswers: group.correct,
              wrongAnswers: group.total - group.correct,
              avgTimeSpent: perQuestionTime,
            },
          });
        }

        for (const r of results) {
          const existing = reviewByQuestion.get(r.questionId);
          const schedule = scheduleNext(
            existing
              ? {
                  intervalDays: existing.intervalDays,
                  ease: existing.ease,
                  repetitions: existing.repetitions,
                  lapses: existing.lapses,
                }
              : initialReviewState(),
            r.isCorrect,
          );

          await tx.reviewItem.upsert({
            where: { userId_questionId: { userId, questionId: r.questionId } },
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
              questionId: r.questionId,
              dueAt: schedule.dueAt,
              intervalDays: schedule.intervalDays,
              ease: schedule.ease,
              repetitions: schedule.repetitions,
              lapses: schedule.lapses,
              lastReviewedAt: new Date(),
            },
          });
        }

        await tx.user.update({
          where: { id: userId },
          data: { xp: { increment: xpGained } },
        });
      },
      { timeout: 30_000, maxWait: 10_000 },
    );

    // Streak fora da transação: getStreakStatus faz suas próprias leituras.
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

    const [updatedUser, todayCount, user, simCount, bySubject] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { xp: true } }),
      prisma.userQuestionHistory.count({ where: { userId, answeredAt: { gte: startOfDay() } } }),
      prisma.user.findUnique({ where: { id: userId }, select: { dailyGoal: true } }),
      prisma.simulado.count({ where: { userId, status: 'finished' } }),
      prisma.performance.groupBy({
        by: ['subject'],
        where: { userId },
        _sum: { totalQuestions: true, correctAnswers: true },
      }),
    ]);

    const newXp = updatedUser?.xp ?? 0;
    const newLevel = getLevelFromXp(newXp);

    const highAccuracy = bySubject.some((s) => {
      const total = s._sum.totalQuestions ?? 0;
      const correct = s._sum.correctAnswers ?? 0;
      return total >= 20 && correct / total >= 0.8;
    });

    const granted = await checkAndGrantAchievements({
      userId,
      streak: streakStatus.streak,
      level: newLevel,
      firstSimulado: simCount === 1,
      perfectSimulado: score === 100,
      dailyGoalMet: todayCount >= (user?.dailyGoal ?? 10),
      highAccuracy,
    });

    return NextResponse.json({
      score: Math.round(score),
      correct,
      wrong: results.length - correct,
      total: results.length,
      timeUsed,
      xpGained,
      newXp,
      newLevel,
      grantedAchievements: granted,
      results,
    });
  } catch (error) {
    return serverError('Erro ao finalizar simulado', error);
  }
}

export async function GET() {
  const auth = await requireUser();
  if (!auth) return unauthorized();

  try {
    const simulados = await prisma.simulado.findMany({
      where: { userId: auth.userId, status: 'finished' },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        score: true,
        totalQuestions: true,
        correctAnswers: true,
        wrongAnswers: true,
        timeUsed: true,
        finishedAt: true,
        subjects: true,
        difficulty: true,
      },
    });

    return NextResponse.json({ simulados });
  } catch (error) {
    return serverError('Erro ao buscar simulados', error);
  }
}
