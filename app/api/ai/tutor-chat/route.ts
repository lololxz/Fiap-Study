import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { tutorChat, MAX_TURNS } from '@/lib/ai/tutor';
import { aiErrorResponse } from '@/lib/ai/client';
import { checkAndGrantAchievements } from '@/lib/achievements';
import { requireUser, unauthorized, badRequest } from '@/lib/api';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rate-limit';

const schema = z.object({
  // Sem .max() antes: dava para mandar uma conversa arbitrariamente grande e
  // reenviar o histórico inteiro a cada turno, amplificando o custo.
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(MAX_TURNS * 2),
  conversationId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: 'Sessão expirada ou não autenticado.' }, { status: 401 });
  }

  const limited = rateLimit(`tutor:${auth.userId}`, LIMITS.aiTutor);
  if (!limited.ok) {
    return NextResponse.json(rateLimitResponse(limited.retryAfterSeconds), { status: 429 });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest('Corpo da requisição inválido.');
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('Dados da conversa inválidos.');

    const { messages, conversationId } = parsed.data;

    const performances = await prisma.performance.findMany({
      where: { userId: auth.userId },
      select: { subject: true, topic: true, totalQuestions: true, correctAnswers: true },
      orderBy: { lastPracticed: 'desc' },
      take: 20,
    });

    const perfSummary =
      performances.length > 0
        ? performances
            .map((p) => {
              const pct =
                p.totalQuestions > 0 ? Math.round((p.correctAnswers / p.totalQuestions) * 100) : 0;
              return `${p.subject}/${p.topic}: ${pct}% (${p.totalQuestions} questões)`;
            })
            .join('\n')
        : 'Nenhum dado de desempenho ainda';

    const response = await tutorChat(messages, auth.name, perfSummary);

    const allMessages = [...messages, { role: 'assistant' as const, content: response }];

    if (conversationId) {
      const updated = await prisma.tutorConversation.updateMany({
        where: { id: conversationId, userId: auth.userId },
        data: { messages: JSON.stringify(allMessages) },
      });

      if (updated.count > 0) {
        return NextResponse.json({ response, conversationId });
      }
    }

    const conv = await prisma.tutorConversation.create({
      data: { userId: auth.userId, messages: JSON.stringify(allMessages) },
    });

    const convCount = await prisma.tutorConversation.count({ where: { userId: auth.userId } });
    const granted = await checkAndGrantAchievements({
      userId: auth.userId,
      firstTutor: convCount === 1,
    });

    return NextResponse.json({
      response,
      conversationId: conv.id,
      grantedAchievements: granted,
    });
  } catch (error) {
    return aiErrorResponse(error, 'Erro no Professor IA. Tente novamente em alguns instantes.');
  }
}
