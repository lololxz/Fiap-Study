import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { assertSecureEnv, warnInsecureEnv } from './env';
import { rateLimit, LIMITS } from './rate-limit';

warnInsecureEnv();

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials, req) {
        assertSecureEnv();

        if (!credentials?.email || !credentials?.password) return null;

        // Freia força bruta por IP antes de tocar no bcrypt.
        const ip =
          (req?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
          'unknown';
        const limited = rateLimit(`login:${ip}`, { limit: 10, windowSeconds: 300 });
        if (!limited.ok) return null;

        const email = credentials.email.trim().toLowerCase();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const isValidPassword = await bcrypt.compare(credentials.password, user.password);
        if (!isValidPassword) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
};
