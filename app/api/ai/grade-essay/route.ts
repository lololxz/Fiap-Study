import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { gradeEssay } from '@/lib/ai/essay-grader';
import { aiErrorResponse } from '@/lib/ai/client';
import { checkAndGrantAchievements } from '@/lib/achievements';
import { requireUser, unauthorized, badRequest } from '@/lib/api';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rate-limit';

const schema = z.object({
  theme: z.string().min(5).max(300),
  // Sem teto, um cliente podia mandar um texto gigante para a API paga.
  content: z.string().min(50).max(20_000),
  essayId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth) return unauthorized();
  const userId = auth.userId;

  const limited = rateLimit(`essay:${userId}`, LIMITS.aiEssay);
  if (!limited.ok) {
    return NextResponse.json(rateLimitResponse(limited.retryAfterSeconds), { status: 429 });
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest('Dados inválidos', parsed.error.errors);

    const { theme, content, essayId } = parsed.data;
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

    // Salva a redação só depois de corrigir: antes o registro era criado antes
    // da IA responder, então uma falha deixava redação sem nota no histórico.
    const gradeResult = await gradeEssay(theme, content);

    let version = 1;
    let parentId: string | null = null;

    if (essayId) {
      const parent = await prisma.essay.findFirst({
        where: { id: essayId, userId },
        select: { version: true },
      });
      if (parent) {
        version = parent.version + 1;
        parentId = essayId;
      }
    }

    const essay = await prisma.essay.create({
      data: { userId, theme, content, wordCount, version, parentId },
    });

    const grade = await prisma.essayGrade.create({
      data: {
        essayId: essay.id,
        totalScore: gradeResult.totalScore,
        themeScore: gradeResult.themeScore,
        structureScore: gradeResult.structureScore,
        cohesionScore: gradeResult.cohesionScore,
        argumentScore: gradeResult.argumentScore,
        grammarScore: gradeResult.grammarScore,
        feedback: gradeResult.feedback,
        highlights: JSON.stringify(gradeResult.highlights),
        suggestions: JSON.stringify(gradeResult.suggestions),
        positives: JSON.stringify(gradeResult.positives),
      },
    });

    const essayCount = await prisma.essay.count({ where: { userId } });

    const granted = await checkAndGrantAchievements({
      userId,
      firstEssay: essayCount === 1,
      essayScore: gradeResult.totalScore,
    });

    return NextResponse.json({
      essayId: essay.id,
      gradeId: grade.id,
      version,
      wordCount,
      ...gradeResult,
      grantedAchievements: granted,
    });
  } catch (error) {
    return aiErrorResponse(error, 'Erro ao corrigir redação');
  }
}
