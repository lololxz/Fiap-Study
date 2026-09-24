import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateQuestion } from '@/lib/ai/question-generator';
import { requireUser, unauthorized, badRequest, serverError } from '@/lib/api';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { aiErrorResponse } from '@/lib/ai/client';
import { SUBJECTS } from '@/lib/subjects';

const validSubjects = SUBJECTS.map((s) => s.id);

function isValidTopic(subject: string, topic: string) {
  return SUBJECTS.find((s) => s.id === subject)?.topics.some((t) => t.id === topic) ?? false;
}

// Whitelist em vez de string livre: esse valor entra direto no prompt.
const schema = z.object({
  subject: z.string().refine((v) => validSubjects.includes(v), 'Matéria inválida'),
  topic: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'challenge']),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth) return unauthorized();

  const limited = rateLimit(`generate:${auth.userId}`, LIMITS.aiQuestion);
  if (!limited.ok) {
    return NextResponse.json(rateLimitResponse(limited.retryAfterSeconds), { status: 429 });
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest('Dados inválidos', parsed.error.errors);

    const { subject, topic, difficulty } = parsed.data;
    if (!isValidTopic(subject, topic)) return badRequest('Tópico inválido para esta matéria');

    // Histórico recente para não repetir enunciado/contexto.
    const recentHistory = await prisma.userQuestionHistory.findMany({
      where: { userId: auth.userId, subject, topic },
      orderBy: { answeredAt: 'desc' },
      take: 20,
      include: { question: { select: { question: true } } },
    });

    const recentQuestions = recentHistory.map((h) => h.question.question.slice(0, 100));
    const recentTopics = Array.from(
      new Set(recentHistory.map((h) => h.topic).filter(Boolean)),
    ) as string[];

    const generated = await generateQuestion(subject, topic, difficulty, recentTopics, recentQuestions);
    if (!generated) {
      return NextResponse.json(
        { error: 'Não foi possível gerar a questão. Tente novamente.' },
        { status: 502 },
      );
    }

    const saved = await prisma.question.upsert({
      where: { hash: generated.hash! },
      update: {},
      create: {
        hash: generated.hash!,
        subject: generated.subject,
        topic: generated.topic,
        difficulty: generated.difficulty,
        question: generated.question,
        options: JSON.stringify(generated.options),
        answer: generated.answer,
        explanation: generated.explanation,
        stepByStep: JSON.stringify(generated.stepByStep),
      },
    });

    // Gabarito, explicação e resolução NÃO saem daqui: só depois de responder,
    // via /api/ai/check-answer.
    return NextResponse.json({
      id: saved.id,
      subject: saved.subject,
      topic: saved.topic,
      difficulty: saved.difficulty,
      question: saved.question,
      options: generated.options,
    });
  } catch (error) {
    return aiErrorResponse(error, 'Erro ao gerar questão');
  }
}
