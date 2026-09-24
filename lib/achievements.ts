import { prisma } from './prisma';

interface AchievementContext {
  userId: string;
  totalQuestions?: number;
  totalCorrect?: number;
  streak?: number;
  level?: number;
  firstSimulado?: boolean;
  perfectSimulado?: boolean;
  firstEssay?: boolean;
  essayScore?: number;
  firstTutor?: boolean;
  firstStudyPlan?: boolean;
  firstErrorReview?: boolean;
  /** Reencontrou na revisão uma questão já respondida antes. */
  repeatReview?: boolean;
  /** Questões acertadas 2+ vezes — revisão consolidada de verdade. */
  consolidatedReviews?: number;
  dailyGoalMet?: boolean;
  highAccuracy?: boolean;
  subjectCorrect?: { subject: string; count: number };
  consecutiveCorrect?: number;
  mathCorrect?: number;
  portugueseCorrect?: number;
}

/**
 * Métrica e alvo de cada conquista, para a UI conseguir mostrar progresso
 * ("12/50") em vez de só bloqueada/desbloqueada.
 */
export const ACHIEVEMENT_TARGETS: Record<
  string,
  { metric: keyof AchievementMetrics; target: number }
> = {
  FIRST_QUESTION: { metric: 'totalQuestions', target: 1 },
  TEN_QUESTIONS: { metric: 'totalQuestions', target: 10 },
  FIFTY_QUESTIONS: { metric: 'totalQuestions', target: 50 },
  HUNDRED_QUESTIONS: { metric: 'totalQuestions', target: 100 },
  FIRST_REVIEW: { metric: 'consolidatedReviews', target: 1 },
  REVIEW_50: { metric: 'consolidatedReviews', target: 50 },
  REVIEW_100: { metric: 'consolidatedReviews', target: 100 },
  STREAK_3: { metric: 'streak', target: 3 },
  STREAK_7: { metric: 'streak', target: 7 },
  STREAK_14: { metric: 'streak', target: 14 },
  STREAK_30: { metric: 'streak', target: 30 },
  LEVEL_5: { metric: 'level', target: 5 },
  LEVEL_10: { metric: 'level', target: 10 },
  MATH_MASTER: { metric: 'mathCorrect', target: 50 },
  PORTUGUESE_MASTER: { metric: 'portugueseCorrect', target: 50 },
};

export interface AchievementMetrics {
  totalQuestions: number;
  consolidatedReviews: number;
  streak: number;
  level: number;
  mathCorrect: number;
  portugueseCorrect: number;
}

export function getAchievementProgress(metrics: AchievementMetrics) {
  const out: Record<string, { current: number; target: number; pct: number }> = {};

  for (const [code, { metric, target }] of Object.entries(ACHIEVEMENT_TARGETS)) {
    const current = Math.max(0, metrics[metric] ?? 0);
    out[code] = {
      current: Math.min(current, target),
      target,
      pct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100,
    };
  }

  return out;
}

export type GrantedAchievement = {
  code: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
};

export async function checkAndGrantAchievements(
  ctx: AchievementContext,
): Promise<GrantedAchievement[]> {
  const granted: GrantedAchievement[] = [];

  const existing = await prisma.userAchievement.findMany({
    where: { userId: ctx.userId },
    select: { achievement: { select: { code: true } } },
  });
  const existingCodes = new Set(existing.map((e) => e.achievement.code));

  async function grant(code: string) {
    if (existingCodes.has(code)) return;
    const achievement = await prisma.achievement.findUnique({ where: { code } });
    if (!achievement) return;

    try {
      await prisma.userAchievement.create({
        data: { userId: ctx.userId, achievementId: achievement.id },
      });
    } catch {
      // Corrida com uma requisição concorrente: a unique (userId, achievementId)
      // garantiu que só um grant aconteceu. Não dá XP de novo.
      existingCodes.add(code);
      return;
    }

    await prisma.user.update({
      where: { id: ctx.userId },
      data: { xp: { increment: achievement.xpReward } },
    });

    granted.push({
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      xpReward: achievement.xpReward,
    });
    existingCodes.add(code);
  }

  const q = ctx.totalQuestions ?? 0;
  if (q >= 1) await grant('FIRST_QUESTION');
  if (q >= 10) await grant('TEN_QUESTIONS');
  if (q >= 50) await grant('FIFTY_QUESTIONS');
  if (q >= 100) await grant('HUNDRED_QUESTIONS');

  if (ctx.firstSimulado) await grant('FIRST_SIMULADO');
  if (ctx.perfectSimulado) await grant('PERFECT_SIMULADO');
  if (ctx.firstEssay) await grant('FIRST_ESSAY');
  if (ctx.essayScore && ctx.essayScore >= 900) await grant('ESSAY_900');
  if (ctx.firstTutor) await grant('AI_TUTOR');
  if (ctx.firstStudyPlan) await grant('STUDY_PLAN');
  if (ctx.highAccuracy) await grant('HIGH_ACCURACY');
  if (ctx.dailyGoalMet) await grant('DAILY_GOAL');
  if (ctx.consecutiveCorrect && ctx.consecutiveCorrect >= 10) await grant('PERFECT_SCORE');

  if (ctx.firstErrorReview) await grant('ERROR_REVIEW');
  if (ctx.repeatReview) await grant('FIRST_REVIEW');
  const reviews = ctx.consolidatedReviews ?? 0;
  if (reviews >= 50) await grant('REVIEW_50');
  if (reviews >= 100) await grant('REVIEW_100');

  const streak = ctx.streak ?? 0;
  if (streak >= 3) await grant('STREAK_3');
  if (streak >= 7) await grant('STREAK_7');
  if (streak >= 14) await grant('STREAK_14');
  if (streak >= 30) await grant('STREAK_30');

  const level = ctx.level ?? 1;
  if (level >= 5) await grant('LEVEL_5');
  if (level >= 10) await grant('LEVEL_10');

  if (ctx.mathCorrect && ctx.mathCorrect >= 50) await grant('MATH_MASTER');
  if (ctx.portugueseCorrect && ctx.portugueseCorrect >= 50) await grant('PORTUGUESE_MASTER');

  return granted;
}

export async function getStreakStatus(
  userId: string,
): Promise<{ streak: number; bestStreak: number; shouldIncrement: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streak: true, bestStreak: true, lastStudyDate: true },
  });

  if (!user) return { streak: 0, bestStreak: 0, shouldIncrement: false };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!user.lastStudyDate) {
    return { streak: 1, bestStreak: Math.max(1, user.bestStreak), shouldIncrement: true };
  }

  const lastDate = new Date(user.lastStudyDate);
  const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
  const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { streak: user.streak, bestStreak: user.bestStreak, shouldIncrement: false };
  }
  if (diffDays === 1) {
    const next = user.streak + 1;
    return { streak: next, bestStreak: Math.max(next, user.bestStreak), shouldIncrement: true };
  }
  return { streak: 1, bestStreak: Math.max(1, user.bestStreak), shouldIncrement: true };
}
