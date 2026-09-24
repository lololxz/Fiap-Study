import { z } from 'zod';
import { aiChat, parseJsonLoose, AiUpstreamError } from './client';
import { buildEssayGradePrompt } from './prompts';

export interface EssayGradeResult {
  totalScore: number;
  themeScore: number;
  structureScore: number;
  cohesionScore: number;
  argumentScore: number;
  grammarScore: number;
  feedback: string;
  highlights: Array<{ type: 'error' | 'positive'; text: string; comment: string }>;
  suggestions: string[];
  positives: string[];
  needsWork: string[];
}

const CRITERIA = [
  'themeScore',
  'structureScore',
  'cohesionScore',
  'argumentScore',
  'grammarScore',
] as const;

const MAX_PER_CRITERION = 200;

/** O modelo às vezes manda "180" em vez de 180, ou um valor fora da faixa. */
const clampedScore = z
  .union([z.number(), z.string()])
  .transform((value) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(MAX_PER_CRITERION, Math.round(n)));
  });

/** Aceita string única e embrulha em array, em vez de quebrar a UI depois. */
const stringList = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((value) => {
    if (!value) return [] as string[];
    const list = Array.isArray(value) ? value : [value];
    return list.map((s) => String(s).trim()).filter(Boolean);
  });

const rawSchema = z.object({
  themeScore: clampedScore,
  structureScore: clampedScore,
  cohesionScore: clampedScore,
  argumentScore: clampedScore,
  grammarScore: clampedScore,
  feedback: z.string().optional(),
  highlights: z
    .array(
      z.object({
        type: z.string().optional(),
        text: z.string().optional(),
        comment: z.string().optional(),
      }),
    )
    .optional(),
  suggestions: stringList,
  positives: stringList,
  needsWork: stringList,
});

/**
 * Lança AiConfigError / AiUpstreamError quando não consegue corrigir — quem
 * chama traduz para o status HTTP certo, em vez de tratar null genérico.
 */
export async function gradeEssay(theme: string, content: string): Promise<EssayGradeResult> {
  try {
    const prompt = buildEssayGradePrompt(theme, content);

    const raw = await aiChat({
      user: prompt,
      temperature: 0.3,
      maxTokens: 2000,
      json: true,
      timeoutMs: 60_000,
    });

    const parsed = rawSchema.safeParse(parseJsonLoose<unknown>(raw));
    if (!parsed.success) {
      throw new AiUpstreamError('A correção veio em um formato inesperado.');
    }

    const data = parsed.data;

    const highlights = (data.highlights ?? [])
      .map((h) => ({
        type: h.type?.toLowerCase() === 'positive' ? ('positive' as const) : ('error' as const),
        text: (h.text ?? '').trim(),
        comment: (h.comment ?? '').trim(),
      }))
      .filter((h) => h.text.length > 0);

    const totalScore = CRITERIA.reduce((sum, key) => sum + data[key], 0);

    return {
      totalScore: Math.max(0, Math.min(1000, totalScore)),
      themeScore: data.themeScore,
      structureScore: data.structureScore,
      cohesionScore: data.cohesionScore,
      argumentScore: data.argumentScore,
      grammarScore: data.grammarScore,
      feedback: (data.feedback ?? '').trim(),
      highlights,
      suggestions: data.suggestions,
      positives: data.positives,
      needsWork: data.needsWork,
    };
  } catch (error) {
    console.error('Correção de redação falhou:', error);
    throw error;
  }
}
