import { NextResponse } from 'next/server';
import { generateEssayThemes } from '@/lib/ai/essay-themes';
import { requireUser, unauthorized } from '@/lib/api';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rate-limit';

export async function GET() {
  const auth = await requireUser();
  if (!auth) return unauthorized();

  const limited = rateLimit(`themes:${auth.userId}`, LIMITS.aiEssay);
  if (!limited.ok) {
    return NextResponse.json(rateLimitResponse(limited.retryAfterSeconds), { status: 429 });
  }

  // generateEssayThemes já cai para a lista fixa quando a IA falha.
  const { themes, offline } = await generateEssayThemes();

  return NextResponse.json({ themes, offline });
}
