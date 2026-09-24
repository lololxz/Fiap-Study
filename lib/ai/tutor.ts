import { aiChat } from './client';
import { buildTutorSystemPrompt } from './prompts';

export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Últimos turnos enviados ao modelo — o cliente reenvia o histórico inteiro. */
export const MAX_TURNS = 20;

export async function tutorChat(
  messages: TutorMessage[],
  studentName: string,
  performanceSummary: string,
): Promise<string> {
  const systemPrompt = buildTutorSystemPrompt(studentName, performanceSummary);

  // Trunca no servidor: sem isso o custo cresce quadraticamente com a conversa.
  const recent = messages.slice(-MAX_TURNS);

  const transcript = recent
    .map((m) => `${m.role === 'user' ? 'Aluno' : 'Professor'}: ${m.content}`)
    .join('\n\n');

  return aiChat({
    system: systemPrompt,
    user: transcript,
    temperature: 0.7,
    maxTokens: 1500,
    timeoutMs: 60_000,
  });
}
