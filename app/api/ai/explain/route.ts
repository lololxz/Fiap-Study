import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { aiChat, aiErrorResponse } from '@/lib/ai/client';
import { requireUser, unauthorized, badRequest, notFound } from '@/lib/api';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rate-limit';

// Antes o cliente mandava question/correctAnswer/explanation como texto livre
// direto para o prompt — injeção de prompt e conteúdo arbitrário. Agora só o id.
const schema = z.object({
  questionId: z.string().min(1),
  style: z.enum(['simpler', 'different']).default('simpler'),
  userAnswer: z.string().max(8).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth) return unauthorized();

  const limited = rateLimit(`explain:${auth.userId}`, LIMITS.aiQuestion);
  if (!limited.ok) {
    return NextResponse.json(rateLimitResponse(limited.retryAfterSeconds), { status: 429 });
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest('Dados inválidos', parsed.error.errors);

    const { questionId, style, userAnswer } = parsed.data;

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        question: true,
        answer: true,
        explanation: true,
        options: true,
        subject: true,
        topic: true,
      },
    });
    if (!question) return notFound('Questão não encontrada');

    let optionsText = '';
    try {
      const options = JSON.parse(question.options) as Array<{ key: string; text: string }>;
      if (Array.isArray(options)) {
        optionsText = options.map((o) => `${o.key}) ${o.text}`).join('\n');
      }
    } catch {
      optionsText = '';
    }

    const styleInstruction =
      style === 'simpler'
        ? 'Explique de forma MAIS SIMPLES, como se fosse para uma criança de 10 anos, usando analogias do dia a dia.'
        : 'Explique de uma forma COMPLETAMENTE DIFERENTE, usando outro método ou abordagem para chegar à mesma resposta.';

    const wrongAnswerNote =
      userAnswer && userAnswer.toUpperCase() !== question.answer.toUpperCase()
        ? `\nO aluno marcou a alternativa ${userAnswer.toUpperCase()}, que está errada. Comece explicando por que essa alternativa não serve.`
        : '';

    const prompt = `Você é um professor didático explicando uma questão para um aluno.

Questão: ${question.question}

Alternativas:
${optionsText}

Resposta correta: ${question.answer}
Explicação original: ${question.explanation}
${wrongAnswerNote}

${styleInstruction}

Seja claro, use exemplos práticos e encoraje o aluno. Responda em Português Brasileiro.`;

    const explanation = await aiChat({
      user: prompt,
      temperature: 0.7,
      maxTokens: 800,
      timeoutMs: 45_000,
    });

    return NextResponse.json({ explanation });
  } catch (error) {
    return aiErrorResponse(error, 'Erro ao gerar explicação');
  }
}
