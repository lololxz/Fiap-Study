import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, serverError } from '@/lib/api';
import { formatInterval } from '@/lib/srs';

/**
 * Itens de revisão vencidos. A resposta aqui NÃO inclui gabarito/explicação —
 * o aluno responde por /api/ai/check-answer, que também reagenda o item.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth) return unauthorized();
  const userId = auth.userId;

  try {
    const limitParam = Number(new URL(req.url).searchParams.get('limit') ?? '20');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

    const now = new Date();

    const [dueItems, dueCount, totalTracked, mastered, nextDue] = await Promise.all([
      prisma.reviewItem.findMany({
        where: { userId, dueAt: { lte: now } },
        orderBy: { dueAt: 'asc' },
        take: limit,
        include: {
          question: {
            select: {
              id: true,
              subject: true,
              topic: true,
              difficulty: true,
              question: true,
              options: true,
            },
          },
        },
      }),
      prisma.reviewItem.count({ where: { userId, dueAt: { lte: now } } }),
      prisma.reviewItem.count({ where: { userId } }),
      prisma.reviewItem.count({
        where: { userId, repetitions: { gte: 3 }, intervalDays: { gte: 7 } },
      }),
      prisma.reviewItem.findFirst({
        where: { userId, dueAt: { gt: now } },
        orderBy: { dueAt: 'asc' },
        select: { dueAt: true },
      }),
    ]);

    const nowMs = now.getTime();

    return NextResponse.json({
      items: dueItems.map((item) => ({
        reviewId: item.id,
        questionId: item.questionId,
        subject: item.question.subject,
        topic: item.question.topic,
        difficulty: item.question.difficulty,
        question: item.question.question,
        options: (() => {
          try {
            const parsed = JSON.parse(item.question.options);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })(),
        repetitions: item.repetitions,
        lapses: item.lapses,
        // Crédito parcial quando o intervalo ainda é curto (caindo no "de novo").
        strength: formatInterval(item.intervalDays),
        isLapsed: item.lapses > 0,
        overdueDays: Math.max(0, Math.floor((nowMs - item.dueAt.getTime()) / 86_400_000)),
      })),
      dueCount,
      totalTracked,
      mastered,
      nextDueAt: nextDue?.dueAt ?? null,
    });
  } catch (error) {
    return serverError('Erro ao buscar revisões', error);
  }
}
