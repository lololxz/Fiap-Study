import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const DEFAULT_BASE_URL = 'https://api.xkiro.com/v1';
const DEFAULT_MODEL = 'qwen/qwen3.6-27b:free';

/** Erro de configuração — vira 503 com mensagem útil, não 500 genérico. */
export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiConfigError';
  }
}

/** Erro de chamada ao provedor (timeout, rede, resposta inválida). */
export class AiUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiUpstreamError';
  }
}

export function getAiConfig() {
  return {
    apiKey: process.env.XKIRO_API_KEY || process.env.OPENAI_API_KEY || '',
    baseURL: process.env.XKIRO_BASE_URL || DEFAULT_BASE_URL,
    model: (process.env.XKIRO_MODEL || DEFAULT_MODEL).trim(),
  };
}

export function getAiModel(): string {
  return getAiConfig().model;
}

let cached: { client: OpenAI; model: string } | null = null;

/**
 * Cliente memoizado, criado na primeira chamada (e não no escopo do módulo como
 * antes, que lia env no import e devolvia null silenciosamente).
 */
export function requireAiClient(): { client: OpenAI; model: string } {
  const { apiKey, baseURL, model } = getAiConfig();

  if (!apiKey) {
    throw new AiConfigError(
      'IA não configurada: defina XKIRO_API_KEY (ou OPENAI_API_KEY) no .env.local.',
    );
  }
  if (!model) {
    throw new AiConfigError('IA não configurada: defina XKIRO_MODEL no .env.local.');
  }

  if (!cached) {
    cached = {
      client: new OpenAI({
        apiKey,
        baseURL,
        defaultHeaders: { 'x-api-key': apiKey },
      }),
      model,
    };
  }

  return cached;
}

/** Mantido para compatibilidade; prefira requireAiClient(). */
export function createAiClient(): OpenAI | null {
  const { apiKey } = getAiConfig();
  if (!apiKey) return null;
  return requireAiClient().client;
}

export type ChatParams = {
  system?: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs?: number;
};

/**
 * Chamada única com timeout. Sem isso, uma chamada pendurada do provedor
 * segura o request inteiro (no simulado, até 90 chamadas em série).
 */
export async function aiChat({
  system,
  user,
  temperature = 0.7,
  maxTokens = 1500,
  json = false,
  timeoutMs = 45_000,
}: ChatParams): Promise<string> {
  const { client, model } = requireAiClient();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages: [
          ...(system ? [{ role: 'system' as const, content: system }] : []),
          { role: 'user' as const, content: user },
        ],
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' as const } } : {}),
      },
      { signal: controller.signal },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new AiUpstreamError('O provedor de IA devolveu uma resposta vazia.');
    return content;
  } catch (error) {
    if (error instanceof AiConfigError || error instanceof AiUpstreamError) throw error;

    if ((error as Error)?.name === 'AbortError') {
      throw new AiUpstreamError(
        `O provedor de IA não respondeu em ${Math.round(timeoutMs / 1000)}s.`,
      );
    }
    throw new AiUpstreamError(
      `Falha ao chamar o provedor de IA: ${(error as Error)?.message ?? 'erro desconhecido'}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Extrai JSON de uma resposta que pode vir com cercas de markdown. */
export function parseJsonLoose<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Alguns modelos embrulham o objeto em texto; tenta isolar o primeiro bloco.
    const start = trimmed.search(/[[{]/);
    const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new AiUpstreamError('O provedor de IA não devolveu JSON válido.');
  }
}

/** Resposta padronizada de erro para as rotas de IA. */
export function aiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof AiConfigError) {
    return NextResponse.json({ error: error.message, code: 'AI_NOT_CONFIGURED' }, { status: 503 });
  }
  if (error instanceof AiUpstreamError) {
    return NextResponse.json({ error: error.message, code: 'AI_UPSTREAM' }, { status: 502 });
  }
  console.error(fallbackMessage, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
