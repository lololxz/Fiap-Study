import { cn } from '@/lib/utils';

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path
            d="M5 19V6.5A1.5 1.5 0 0 1 6.5 5H18"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
          <path d="M5 12.5h9" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
      </span>
      {showText && (
        <span className="text-[0.9375rem] font-semibold tracking-tight">FIAP Prep</span>
      )}
    </span>
  );
}
