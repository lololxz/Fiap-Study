'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type DailyPoint = { date: string; total: number; correct: number; accuracy: number };

/** Recharts mede o container, então só renderiza depois do mount. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function shortDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '0.625rem',
  fontSize: '0.75rem',
  color: 'hsl(var(--popover-foreground))',
  padding: '0.5rem 0.75rem',
} as const;

export function ActivityChart({ data }: { data: DailyPoint[] }) {
  const mounted = useMounted();

  if (!mounted) return <div className="h-[220px] w-full" />;

  const series = data.map((d) => ({
    ...d,
    label: shortDate(d.date),
    wrong: d.total - d.correct,
  }));

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="fillCorrect" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.45} />
              <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fillWrong" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-5))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--chart-5))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={38}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}
            formatter={(value: number, name: string) => [
              value,
              name === 'correct' ? 'Acertos' : 'Erros',
            ]}
          />
          <Area
            type="monotone"
            dataKey="correct"
            stackId="1"
            stroke="hsl(var(--chart-3))"
            strokeWidth={2}
            fill="url(#fillCorrect)"
          />
          <Area
            type="monotone"
            dataKey="wrong"
            stackId="1"
            stroke="hsl(var(--chart-5))"
            strokeWidth={2}
            fill="url(#fillWrong)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AccuracyBySubjectChart({
  data,
}: {
  data: Array<{ subject: string; label: string; accuracy: number; total: number }>;
}) {
  const mounted = useMounted();

  if (!mounted) return <div className="h-[220px] w-full" />;

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            domain={[0, 100]}
            unit="%"
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'hsl(var(--accent))' }}
            formatter={(value: number, _name: string, item: any) => [
              `${value}% (${item?.payload?.total ?? 0} questões)`,
              'Precisão',
            ]}
          />
          <Bar dataKey="accuracy" radius={[6, 6, 0, 0]} maxBarSize={72}>
            {data.map((entry, index) => (
              <Cell
                key={entry.subject}
                fill={`hsl(var(--chart-${(index % 5) + 1}))`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function XpProgressChart({ data }: { data: DailyPoint[] }) {
  const mounted = useMounted();

  if (!mounted) return <div className="h-[200px] w-full" />;

  // XP acumulado aproximado: 10 por acerto, 2 por erro.
  let running = 0;
  const series = data.map((d) => {
    running += d.correct * 10 + (d.total - d.correct) * 2;
    return { label: shortDate(d.date), xp: running };
  });

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="fillXp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [`${value} XP`, 'Acumulado']}
          />
          <Area
            type="monotone"
            dataKey="xp"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fill="url(#fillXp)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
