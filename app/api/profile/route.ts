import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser, unauthorized, badRequest, serverError } from '@/lib/api';

const patchSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    dailyGoal: z.number().int().min(1).max(200).optional(),
  })
  .refine((d) => d.name !== undefined || d.dailyGoal !== undefined, {
    message: 'Nada para atualizar',
  });

export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (!auth) return unauthorized();

  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest('Dados inválidos', parsed.error.errors);

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: parsed.data,
      select: { id: true, name: true, email: true, dailyGoal: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return serverError('Erro ao atualizar perfil', error);
  }
}
