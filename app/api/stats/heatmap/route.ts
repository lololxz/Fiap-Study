import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, serverError, dayKey } from '@/lib/api';

/** Calendário de ofensiva: questões respondidas por dia, no estilo GitHub. */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth) return unauthorized();

  try {
    const daysParam = Number(new URL(req.url).searchParams.get('days') ?? '182');
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 7), 371) : 182;

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const history = await prisma.userQuestionHistory.findMany({
      where: { userId: auth.userId, answeredAt: { gte: since } },
      select: { answeredAt: true, isCorrect: true },
      orderBy: { answeredAt: 'asc' },
    });

    const byDay = new Map<string, { total: number; correct: number }>();
    for (const h of history) {
      const key = dayKey(new Date(h.answeredAt));
      const entry = byDay.get(key) ?? { total: 0, correct: 0 };
      entry.total += 1;
      if (h.isCorrect) entry.correct += 1;
      byDay.set(key, entry);
    }

    const cells: Array<{ date: string; count: number; correct: number }> = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const entry = byDay.get(key) ?? { total: 0, correct: 0 };
      cells.push({ date: key, count: entry.total, correct: entry.correct });
    }

    const activeDays = cells.filter((c) => c.count > 0).length;

    return NextResponse.json({
      cells,
      activeDays,
      totalDays: days,
      busiest: cells.reduce(
        (best, c) => (c.count > best.count ? c : best),
        cells[0] ?? { date: '', count: 0, correct: 0 },
      ),
    });
  } catch (error) {
    return serverError('Erro ao buscar ofensiva', error);
  }
}
