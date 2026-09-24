import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAchievementProgress } from '@/lib/achievements';
import { getLevelFromXp, getLevelName, getXpForLevel } from '@/lib/utils';
import { requireUser, unauthorized, serverError, startOfDay, dayKey } from '@/lib/api';

export async function GET() {
  const auth = await requireUser();
  if (!auth) return unauthorized();
  const userId = auth.userId;

  try {
    const [
      user,
      performances,
      totalQuestions,
      totalCorrect,
      weekHistory,
      achievements,
      catalog,
      todayCount,
      dueCount,
      masteredCount,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          xp: true,
          level: true,
          streak: true,
          bestStreak: true,
          dailyGoal: true,
          createdAt: true,
        },
      }),
      prisma.performance.findMany({
        where: { userId },
        orderBy: { lastPracticed: 'desc' },
      }),
      prisma.userQuestionHistory.count({ where: { userId } }),
      prisma.userQuestionHistory.count({ where: { userId, isCorrect: true } }),
      prisma.userQuestionHistory.findMany({
        where: {
          userId,
          answeredAt: { gte: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000) },
        },
        select: { answeredAt: true, isCorrect: true, subject: true },
        orderBy: { answeredAt: 'asc' },
      }),
      prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
      }),
      prisma.achievement.findMany({ orderBy: [{ category: 'asc' }, { xpReward: 'asc' }] }),
      prisma.userQuestionHistory.count({
        where: { userId, answeredAt: { gte: startOfDay() } },
      }),
      prisma.reviewItem.count({ where: { userId, dueAt: { lte: new Date() } } }),
      prisma.reviewItem.count({ where: { userId, repetitions: { gte: 3 }, intervalDays: { gte: 7 } } }),
    ]);

    const xp = user?.xp ?? 0;
    const level = getLevelFromXp(xp);

    // Séries diárias para os gráficos: preenche os dias sem atividade com zero.
    const byDay = new Map<string, { total: number; correct: number }>();
    for (const h of weekHistory) {
      const key = dayKey(new Date(h.answeredAt));
      const entry = byDay.get(key) ?? { total: 0, correct: 0 };
      entry.total += 1;
      if (h.isCorrect) entry.correct += 1;
      byDay.set(key, entry);
    }

    const daily: Array<{ date: string; total: number; correct: number; accuracy: number }> = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const entry = byDay.get(key) ?? { total: 0, correct: 0 };
      daily.push({
        date: key,
        total: entry.total,
        correct: entry.correct,
        accuracy: entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0,
      });
    }

    const [mathCorrect, portugueseCorrect, consolidatedReviews] = await Promise.all([
      prisma.userQuestionHistory.count({ where: { userId, isCorrect: true, subject: 'matematica' } }),
      prisma.userQuestionHistory.count({ where: { userId, isCorrect: true, subject: 'portugues' } }),
      prisma.reviewItem.count({ where: { userId, repetitions: { gte: 2 } } }),
    ]);

    const metrics = {
      totalQuestions,
      consolidatedReviews,
      streak: user?.streak ?? 0,
      level,
      mathCorrect,
      portugueseCorrect,
    };

    const progress = getAchievementProgress(metrics);
    const unlockedByCode = new Map(achievements.map((a) => [a.achievement.code, a.unlockedAt]));

    // Catálogo completo: a UI mostra as bloqueadas com barra de progresso, então
    // precisa das conquistas que o usuário ainda não desbloqueou.
    const achievementList = catalog.map((achievement) => ({
      ...achievement,
      unlocked: unlockedByCode.has(achievement.code),
      unlockedAt: unlockedByCode.get(achievement.code) ?? null,
      progress: progress[achievement.code] ?? null,
    }));

    return NextResponse.json({
      user: user
        ? {
            ...user,
            level,
            levelName: getLevelName(level),
            xpForCurrentLevel: getXpForLevel(level),
            xpForNextLevel: getXpForLevel(level + 1),
          }
        : null,
      performances,
      totalQuestions,
      totalCorrect,
      accuracyRate: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
      todayCount,
      dailyGoal: user?.dailyGoal ?? 10,
      dueCount,
      masteredCount,
      daily,
      weekHistory,
      achievements: achievementList,
      unlockedCount: unlockedByCode.size,
      totalAchievements: catalog.length,
    });
  } catch (error) {
    return serverError('Erro ao buscar desempenho', error);
  }
}
