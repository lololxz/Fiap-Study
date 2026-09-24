'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export type HeatmapCell = { date: string; count: number; correct: number };

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Escala de intensidade relativa ao dia mais ativo do período. */
function level(count: number, max: number) {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

const LEVEL_CLASS = [
  'bg-muted',
  'bg-primary/25',
  'bg-primary/45',
  'bg-primary/70',
  'bg-primary',
];

export function StreakHeatmap({
  cells,
  className,
}: {
  cells: HeatmapCell[];
  className?: string;
}) {
  const { weeks, max, monthLabels } = useMemo(() => {
    if (cells.length === 0) {
      return { weeks: [] as HeatmapCell[][], max: 0, monthLabels: [] as Array<{ index: number; label: string }> };
    }

    const maxCount = Math.max(...cells.map((c) => c.count), 1);

    // Alinha a primeira coluna no domingo para as linhas serem dias da semana.
    const firstWeekday = new Date(`${cells[0].date}T00:00:00`).getDay();
    const padded: Array<HeatmapCell | null> = [
      ...Array.from({ length: firstWeekday }, () => null),
      ...cells,
    ];

    const chunked: HeatmapCell[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      chunked.push(padded.slice(i, i + 7).filter(Boolean) as HeatmapCell[]);
    }

    const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const labels: Array<{ index: number; label: string }> = [];
    let lastMonth = -1;

    chunked.forEach((week, index) => {
      const first = week[0];
      if (!first) return;
      const month = new Date(`${first.date}T00:00:00`).getMonth();
      if (month !== lastMonth) {
        labels.push({ index, label: MONTHS[month] });
        lastMonth = month;
      }
    });

    return { weeks: chunked, max: maxCount, monthLabels: labels };
  }, [cells]);

  if (weeks.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem atividade registrada ainda.</p>;
  }

  return (
    <div className={className}>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-full flex-col gap-1">
          <div className="flex gap-[3px] pl-5">
            {weeks.map((_, i) => {
              const label = monthLabels.find((m) => m.index === i);
              return (
                <span
                  key={i}
                  className="w-[11px] shrink-0 text-2xs text-muted-foreground"
                  aria-hidden="true"
                >
                  {label ? label.label : ''}
                </span>
              );
            })}
          </div>

          <div className="flex gap-[3px]">
            <div className="flex w-4 shrink-0 flex-col gap-[3px]">
              {WEEKDAYS.map((d, i) => (
                <span
                  key={i}
                  className="flex h-[11px] items-center text-2xs leading-none text-muted-foreground"
                  aria-hidden="true"
                >
                  {i % 2 === 1 ? d : ''}
                </span>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="flex shrink-0 flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, di) => {
                  const cell = week[di];
                  if (!cell) {
                    return <span key={di} className="h-[11px] w-[11px]" />;
                  }
                  const lvl = level(cell.count, max);
                  return (
                    <span
                      key={cell.date}
                      title={`${cell.date}: ${cell.count} questão${cell.count === 1 ? '' : 's'}${
                        cell.count > 0 ? ` · ${cell.correct} acerto${cell.correct === 1 ? '' : 's'}` : ''
                      }`}
                      className={cn('h-[11px] w-[11px] rounded-[3px]', LEVEL_CLASS[lvl])}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-2xs text-muted-foreground">
        <span>menos</span>
        {LEVEL_CLASS.map((cls, i) => (
          <span key={i} className={cn('h-[10px] w-[10px] rounded-[3px]', cls)} />
        ))}
        <span>mais</span>
      </div>
    </div>
  );
}
