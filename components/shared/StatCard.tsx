import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'primary' | 'success' | 'warning';
  className?: string;
}) {
  const toneRing = {
    default: 'border-border',
    primary: 'border-primary/30',
    success: 'border-success/30',
    warning: 'border-warning/30',
  }[tone];

  const toneIcon = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
  }[tone];

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 transition-colors hover:border-border/80',
        toneRing,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className={cn('h-4 w-4', toneIcon)} />}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
