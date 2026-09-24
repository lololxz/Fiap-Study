import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Proteção de rota no servidor. Antes disso o guard era só client-side
 * (DashboardShell), então a página era servida a quem não estava logado e só
 * depois redirecionava.
 */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/practice',
  '/simulado',
  '/redacao',
  '/professor-ia',
  '/plano-estudos',
  '/meus-erros',
  '/revisao',
  '/perfil',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/practice/:path*',
    '/simulado/:path*',
    '/redacao/:path*',
    '/professor-ia/:path*',
    '/plano-estudos/:path*',
    '/meus-erros/:path*',
    '/revisao/:path*',
    '/perfil/:path*',
  ],
};
