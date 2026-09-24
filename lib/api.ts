import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export type AuthedUser = { userId: string; name: string };

/**
 * Centraliza o guard de sessão que estava repetido (com pequenas variações)
 * em todas as rotas de API.
 */
export async function requireUser(): Promise<AuthedUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return {
    userId: session.user.id,
    name: session.user.name ?? 'Aluno',
  };
}

export function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}

export function badRequest(message = 'Dados inválidos', details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status: 400 });
}

export function notFound(message = 'Não encontrado') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message: string, error?: unknown) {
  if (error) console.error(`${message}:`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Início do dia local, usado em agregações por data. */
export function startOfDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Chave `YYYY-MM-DD` no fuso local (não usar toISOString, que é UTC). */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
