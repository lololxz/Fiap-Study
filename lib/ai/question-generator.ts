import crypto from 'crypto';
import { z } from 'zod';
import { aiChat, parseJsonLoose } from './client';
import { buildQuestionPrompt } from './prompts';

export interface GeneratedQuestion {
  id?: string;
  subject: string;
  topic: string;
  difficulty: string;
  question: string;
  options: Array<{ key: string; text: string }>;
  answer: string;
  explanation: string;
  stepByStep: string[];
  concept: string;
  contextTag: string;
  hash?: string;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

const rawSchema = z.object({
  question: z.string().min(10),
  options: z.array(z.object({ key: z.string().optional(), text: z.string().min(1) })).length(4),
  answer: z.union([z.string(), z.number()]),
  explanation: z.string().min(1),
  stepByStep: z.array(z.string().min(1)).min(2),
  concept: z.string().optional(),
  contextTag: z.string().optional(),
});

function hashQuestion(question: string, subject: string, topic: string): string {
  return crypto
    .createHash('sha256')
    .update(`${subject}|${topic}|${question.toLowerCase().trim()}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Normaliza as alternativas para A–D na ordem em que vieram e reescreve o
 * gabarito de acordo. Modelos às vezes devolvem chaves minúsculas, fora de
 * ordem, ou o índice numérico ("2") em vez da letra — antes isso derrubava a
 * validação e a geração falhava.
 */
function normalize(raw: z.infer<typeof rawSchema>): Omit<GeneratedQuestion, 'subject' | 'topic' | 'difficulty' | 'hash'> | null {
  const options = raw.options.map((opt, i) => ({ key: OPTION_KEYS[i], text: opt.text.trim() }));

  const rawAnswer = String(raw.answer).trim().toUpperCase();

  let index = -1;

  // Caso 1: o gabarito casa com a chave original de alguma alternativa.
  const byOriginalKey = raw.options.findIndex((opt) => (opt.key ?? '').trim().toUpperCase() === rawAnswer);
  if (byOriginalKey !== -1) {
    index = byOriginalKey;
  } else if (OPTION_KEYS.includes(rawAnswer as (typeof OPTION_KEYS)[number])) {
    // Caso 2: já é uma letra A–D.
    index = OPTION_KEYS.indexOf(rawAnswer as (typeof OPTION_KEYS)[number]);
  } else if (/^[1-4]$/.test(rawAnswer)) {
    // Caso 3: índice numérico 1-based.
    index = Number(rawAnswer) - 1;
  } else {
    // Caso 4: o modelo repetiu o texto da alternativa correta.
    index = raw.options.findIndex((opt) => opt.text.trim() === String(raw.answer).trim());
  }

  if (index < 0 || index > 3) return null;

  return {
    question: raw.question.trim(),
    options,
    answer: OPTION_KEYS[index],
    explanation: raw.explanation.trim(),
    stepByStep: raw.stepByStep.map((s) => s.trim()),
    concept: raw.concept?.trim() ?? '',
    contextTag: raw.contextTag?.trim() ?? '',
  };
}

export async function generateQuestion(
  subject: string,
  topic: string,
  difficulty: string,
  recentTopics: string[] = [],
  recentQuestions: string[] = [],
  attempt = 1,
): Promise<GeneratedQuestion | null> {
  const MAX_ATTEMPTS = 3;
  if (attempt > MAX_ATTEMPTS) return null;

  try {
    const prompt = buildQuestionPrompt({ subject, topic, difficulty, recentTopics, recentQuestions });

    const content = await aiChat({
      user: prompt,
      temperature: Math.min(1, 0.8 + attempt * 0.05),
      maxTokens: 1500,
      json: true,
      timeoutMs: 45_000,
    });

    const parsed = rawSchema.safeParse(parseJsonLoose<unknown>(content));

    if (!parsed.success) {
      console.warn(`Tentativa ${attempt}: estrutura de questão inválida, tentando de novo.`);
      return generateQuestion(subject, topic, difficulty, recentTopics, recentQuestions, attempt + 1);
    }

    const normalized = normalize(parsed.data);
    if (!normalized) {
      console.warn(`Tentativa ${attempt}: gabarito não localizável nas alternativas.`);
      return generateQuestion(subject, topic, difficulty, recentTopics, recentQuestions, attempt + 1);
    }

    return {
      ...normalized,
      subject,
      topic,
      difficulty,
      hash: hashQuestion(normalized.question, subject, topic),
    };
  } catch (error) {
    console.error(`Geração de questão falhou (tentativa ${attempt}):`, error);
    if (attempt < MAX_ATTEMPTS) {
      return generateQuestion(subject, topic, difficulty, recentTopics, recentQuestions, attempt + 1);
    }
    return null;
  }
}

/** Gera várias questões com concorrência limitada, preservando a ordem. */
export async function generateQuestionBatch(
  requests: Array<{ subject: string; topic: string; difficulty: string }>,
  concurrency = 4,
): Promise<Array<GeneratedQuestion | null>> {
  const results: Array<GeneratedQuestion | null> = new Array(requests.length).fill(null);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, requests.length) }, async () => {
    while (cursor < requests.length) {
      const index = cursor;
      cursor += 1;
      const req = requests[index];
      results[index] = await generateQuestion(req.subject, req.topic, req.difficulty);
    }
  });

  await Promise.all(workers);
  return results;
}
