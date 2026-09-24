import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const userId = session.user.id;

    const essays = await prisma.essay.findMany({
      where: { userId },
      include: { grades: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ essays });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar redações' }, { status: 500 });
  }
}
