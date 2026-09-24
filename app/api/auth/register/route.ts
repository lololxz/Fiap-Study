import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import { badRequest, serverError } from '@/lib/api';

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(200),
});

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  const limited = rateLimit(`register:${ip}`, LIMITS.register);
  if (!limited.ok) {
    return NextResponse.json(rateLimitResponse(limited.retryAfterSeconds), { status: 429 });
  }

  try {
    const parsed = registerSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest('Dados inválidos', parsed.error.errors);

    const { name, password } = parsed.data;

    // Normaliza: sem isso "User@x.com" e "user@x.com" viravam duas contas e o
    // login (comparação exata) não encontrava nenhuma das duas.
    const email = parsed.data.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Este email já está cadastrado.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name: name.trim(), email, password: hashedPassword },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return serverError('Erro ao criar conta', error);
  }
}
