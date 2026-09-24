import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get('subject');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = 20;

    const where: any = { userId, isCorrect: false, needsReview: true };
    if (subject) where.subject = subject;

    const [errors, total] = await Promise.all([
      prisma.userQuestionHistory.findMany({
        where,
        include: { question: true },
        orderBy: { answeredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.userQuestionHistory.count({ where }),
    ]);

    return NextResponse.json({
      errors: errors.map(e => ({
        id: e.id,
        subject: e.subject,
        topic: e.topic,
        difficulty: e.difficulty,
        userAnswer: e.userAnswer,
        correctAnswer: e.question.answer,
        question: e.question.question,
        options: JSON.parse(e.question.options),
        explanation: e.question.explanation,
        stepByStep: JSON.parse(e.question.stepByStep),
        answeredAt: e.answeredAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar erros' }, { status: 500 });
  }
}
