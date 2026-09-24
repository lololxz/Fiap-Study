/**
 * Guardas de configuração.
 *
 * O segredo do NextAuth assina o JWT de sessão: com `strategy: 'jwt'`, quem
 * conhece o segredo forja um token com o id de qualquer usuário. Os valores
 * abaixo são os que já apareceram neste repositório e em exemplos públicos,
 * então são tratados como comprometidos.
 */

const COMPROMISED_SECRETS = new Set([
  'fiap-estudos-secret-key-2024-very-secure',
  'your-secret-here-generate-with-openssl-rand-base64-32',
  'secret',
  'changeme',
  'development',
]);

export const MIN_SECRET_LENGTH = 32;

export function getSecretProblem(): string | null {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) return 'NEXTAUTH_SECRET não está definido.';
  if (COMPROMISED_SECRETS.has(secret)) {
    return 'NEXTAUTH_SECRET usa um valor conhecido/público. Gere outro com: openssl rand -base64 32';
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    return `NEXTAUTH_SECRET tem ${secret.length} caracteres; o mínimo é ${MIN_SECRET_LENGTH}. Gere outro com: openssl rand -base64 32`;
  }
  return null;
}

/**
 * Chamado no caminho de autenticação (não no escopo do módulo) porque
 * `next build` define NODE_ENV=production e avalia os módulos de rota — lançar
 * no import quebraria o build.
 */
export function assertSecureEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const problem = getSecretProblem();
  if (problem) {
    throw new Error(`Configuração insegura recusada em produção: ${problem}`);
  }
}

/** Aviso alto e visível, mas que não derruba o build. */
export function warnInsecureEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const problem = getSecretProblem();
  if (problem) {
    console.error(
      `\n[FIAP Prep] ATENÇÃO — configuração insegura: ${problem}\n` +
        'As sessões são falsificáveis enquanto isso não for corrigido.\n',
    );
  }
}
