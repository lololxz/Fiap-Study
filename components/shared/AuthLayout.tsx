import { Logo } from '@/components/shared/Logo';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Malha sutil + brilho do acento, no lugar dos gradientes coloridos */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] glow-accent" aria-hidden="true" />

      <div className="animate-fade-up relative w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-lifted">
          <div className="mb-5 space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>

        {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
