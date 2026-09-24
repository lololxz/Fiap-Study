'use client';

import { cn } from '@/lib/utils';

/** Anel de progresso da meta diária. SVG puro — não vale trazer lib para isso. */
export function GoalRing({
  value,
  target,
  size = 132,
  stroke = 10,
  label = 'hoje',
  className,
}: {
  value: number;
  target: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const safeTarget = Math.max(1, target);
  const pct = Math.min(100, Math.round((value / safeTarget) * 100));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  const done = value >= safeTarget;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className={cn(
            'transition-[stroke-dasharray] duration-700 ease-out',
            done ? 'stroke-success' : 'stroke-primary',
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-2xl font-semibold tracking-tight">
          {value}
          <span className="text-sm font-normal text-muted-foreground">/{safeTarget}</span>
        </span>
        <span className="mt-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
          {done ? 'meta batida' : label}
        </span>
      </div>
      <span className="sr-only">
        {value} de {safeTarget} questões respondidas hoje ({pct}%)
      </span>
    </div>
  );
}
