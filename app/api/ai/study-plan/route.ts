import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateStudyPlan } from '@/lib/ai/study-plan';
import { aiErrorResponse } from '@/lib/ai/client';
import { checkAndGrantAchievements } from '@/lib/achievements';
import { requireUser, unauthorized, serverError } from '@/lib/api';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rate-limit';

export async function GET() {
  const auth = await requireUser();
  if (!auth) return unauthorized();

  try {
    const plan = await prisma.studyPlan.findUnique({ where: { userId: auth.userId } });
    if (!plan) return NextResponse.json({ plan: null });

    try {
      return NextResponse.json({ plan: JSON.parse(plan.plan), generatedAt: plan.generatedAt });
    } catch {
      // Linha corrompida: melhor devolver "sem plano" do que quebrar a tela.
      return NextResponse.json({ plan: null });
    }
  } catch (error) {
    return serverError('Erro ao buscar plano', error);
  }
}

export async function POST() {
  const auth = await requireUser();
  if (!auth) return unauthorized();

  const limited = rateLimit(`plan:${auth.userId}`, LIMITS.aiStudyPlan);
  if (!limited.ok) {
    return NextResponse.json(rateLimitResponse(limited.retryAfterSeconds), { status: 429 });
  }

  try {
    const [performances, user] = await Promise.all([
      prisma.performance.findMany({
        where: { userId: auth.userId },
        select: {
          subject: true,
          topic: true,
          totalQuestions: true,
          correctAnswers: true,
          wrongAnswers: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: { dailyGoal: true, studyPlan: { select: { id: true } } },
      }),
    ]);

    const isFirstPlan = !user?.studyPlan;

    const planData = await generateStudyPlan(auth.name, performances, {
      daysPerWeek: 5,
      minutesPerDay: 60,
    });

    await prisma.studyPlan.upsert({
      where: { userId: auth.userId },
      update: { plan: JSON.stringify(planData) },
      create: { userId: auth.userId, plan: JSON.stringify(planData) },
    });

    const granted = await checkAndGrantAchievements({
      userId: auth.userId,
      firstStudyPlan: isFirstPlan,
    });

    return NextResponse.json({ plan: planData, grantedAchievements: granted });
  } catch (error) {
    return aiErrorResponse(error, 'Erro ao gerar plano de estudos');
  }
}
