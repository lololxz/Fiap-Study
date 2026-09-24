/**
 * Rate limit em memória (token bucket por usuário + rota).
 *
 * LIMITAÇÃO CONHECIDA: o estado vive no processo, então em deploy com múltiplas
 * instâncias o limite real é (N × limite). Serve para proteger contra um único
 * cliente abusando da chave de IA, não contra abuso distribuído. Em produção o
 * certo é Redis ou uma tabela no banco.
 */

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

/** Evita crescimento sem limite do Map em processos de vida longa. */
const MAX_BUCKETS = 5000;

function sweep(now: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > 60 * 60 * 1000) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const refillPerMs = limit / (windowSeconds * 1000);
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: limit, updatedAt: now };
    buckets.set(key, bucket);
  } else {
    const elapsed = now - bucket.updatedAt;
    bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillPerMs);
    bucket.updatedAt = now;
  }

  if (bucket.tokens < 1) {
    const missing = 1 - bucket.tokens;
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(missing / refillPerMs / 1000)),
    };
  }

  bucket.tokens -= 1;
  return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterSeconds: 0 };
}

/**
 * Limites por rota — as que gastam tokens de IA são as apertadas.
 *
 * Note que o limite de geração é folgado por natureza: cada chamada leva
 * segundos, então um cliente sequencial é limitado pela latência do provedor
 * antes de esgotar o balde. O que este limitador realmente barra é disparo
 * concorrente, que consome tokens sem esperar a latência.
 */
export const LIMITS = {
  aiQuestion: { limit: 12, windowSeconds: 60 },
  aiTutor: { limit: 15, windowSeconds: 60 },
  aiEssay: { limit: 6, windowSeconds: 300 },
  aiStudyPlan: { limit: 4, windowSeconds: 300 },
  simulado: { limit: 4, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 600 },
} as const;

export function rateLimitResponse(retryAfterSeconds: number) {
  return {
    error: 'Muitas requisições. Aguarde um instante e tente novamente.',
    retryAfterSeconds,
  };
}
