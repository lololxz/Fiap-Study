import { z } from 'zod';
import { aiChat, parseJsonLoose, AiUpstreamError } from './client';
import { buildStudyPlanPrompt } from './prompts';

export interface StudyPlanDay {
  day: string;
  tasks: Array<{ subject: string; topic: string; duration: number; description: string }>;
}

export interface StudyPlanResult {
  weeklyPlan: StudyPlanDay[];
  focus: string;
  motivation: string;
  weeklyGoal: string;
}

const taskSchema = z.object({
  subject: z.string().default('geral'),
  topic: z.string().default('geral'),
  duration: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.min(300, Math.round(n))) : 0;
    }),
  description: z.string().default(''),
});

// `tasks` é obrigatório: o cliente faz `day.tasks.reduce`/`.map` e quebrava
// quando o modelo omitia o campo.
const daySchema = z.object({
  day: z.string().min(1),
  tasks: z.array(taskSchema).default([]),
});

const rawSchema = z.object({
  weeklyPlan: z.array(daySchema).default([]),
  focus: z.string().default(''),
  motivation: z.string().default(''),
  weeklyGoal: z.string().default(''),
});

export async function generateStudyPlan(
  studentName: string,
  performances: unknown[],
  preferences: { daysPerWeek?: number; minutesPerDay?: number },
): Promise<StudyPlanResult> {
  const prompt = buildStudyPlanPrompt(studentName, performances, preferences);

  const raw = await aiChat({
    user: prompt,
    temperature: 0.5,
    maxTokens: 2000,
    json: true,
    timeoutMs: 60_000,
  });

  const parsed = rawSchema.safeParse(parseJsonLoose<unknown>(raw));
  if (!parsed.success) {
    throw new AiUpstreamError('O plano de estudos veio em um formato inesperado.');
  }

  const data = parsed.data;

  return {
    weeklyPlan: data.weeklyPlan
      .filter((d) => d.tasks.length > 0)
      .map((d) => ({ day: d.day, tasks: d.tasks })),
    focus: data.focus,
    motivation: data.motivation,
    weeklyGoal: data.weeklyGoal,
  };
}
