'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  Flame,
  Repeat,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard, SkeletonList } from '@/components/shared/Skeleton';
import { GoalRing } from '@/components/charts/GoalRing';
import type { DailyPoint } from '@/components/charts/ActivityChart';
import { StreakHeatmap, type HeatmapCell } from '@/components/charts/StreakHeatmap';
import { useUserStats } from '@/lib/hooks/use-user-stats';
import { getLevelName, getSubjectLabel, getTopicLabel } from '@/lib/utils';
import { formatRelative } from '@/lib/format';

// Recharts pesa ~100 kB; sai do bundle inicial do dashboard e carrega sob demanda.
const chartFallback = () => <div className="h-[220px] w-full" />;

const ActivityChart = dynamic(
  () => import('@/components/charts/ActivityChart').then((m) => m.ActivityChart),
  { ssr: false, loading: chartFallback },
);

const AccuracyBySubjectChart = dynamic(
  () => import('@/components/charts/ActivityChart').then((m) => m.AccuracyBySubjectChart),
  { ssr: false, loading: chartFallback },
);

const XpProgressChart = dynamic(
  () => import('@/components/charts/ActivityChart').then((m) => m.XpProgressChart),
  { ssr: false, loading: () => <div className="h-[200px] w-full" /> },
);

export function DashboardClient({ userName }: { userName: string }) {
  const { data, loading, error } = useUserStats();
  const [range, setRange] = useState<'7' | '30'>('7');
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/stats/heatmap?days=182')
      .then((res) => res.json())
      .then((json) => {
        if (active) setHeatmap(json.cells ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setHeatmapLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const rangedDaily = useMemo(() => {
    const days = range === '7' ? 7 : 30;
    // Lê de data?.daily direto: um `?? []` fora do memo criaria array novo a
    // cada render e invalidaria a memoização.
    return ((data?.daily ?? []) as DailyPoint[]).slice(-days);
  }, [data?.daily, range]);

  const accuracyBySubject = useMemo(() => {
    const map = new Map<string, { total: number; correct: number }>();
    for (const p of data?.performances ?? []) {
      const entry = map.get(p.subject) ?? { total: 0, correct: 0 };
      entry.total += p.totalQuestions;
      entry.correct += p.correctAnswers;
      map.set(p.subject, entry);
    }
    return Array.from(map.entries()).map(([subject, v]) => ({
      subject,
      label: getSubjectLabel(subject),
      total: v.total,
      accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    }));
  }, [data?.performances]);

  const user = data?.user;
  const level = user?.level ?? 1;
  const xpNext = user?.xpForNextLevel ?? 0;
  const xpCurrent = user?.xpForCurrentLevel ?? 0;
  const span = xpNext - xpCurrent;
  const xpProgress = span > 0 ? Math.min(100, Math.max(0, (((user?.xp ?? 0) - xpCurrent) / span) * 100)) : 100;

  const firstName = userName.split(' ')[0];

  if (error) {
    return (
      <EmptyState
        icon={Activity}
        title="Não foi possível carregar seus dados"
        description={error}
      >
        <Button onClick={() => window.location.reload()}>Recarregar</Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
          <h1 className="text-2xl font-semibold tracking-tight">{firstName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/practice/matematica">
              <Sparkles className="h-4 w-4" />
              Praticar
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/simulado">
              <Zap className="h-4 w-4" />
              Simulado
            </Link>
          </Button>
        </div>
      </div>

      {/* Linha 1: meta, nível, ofensiva, fila de revisão */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="sm:col-span-2 xl:col-span-1">
            <CardContent className="flex items-center gap-5 p-5">
              {loading ? (
                <SkeletonCard className="border-0 p-0" />
              ) : (
                <>
                  <GoalRing value={data?.todayCount ?? 0} target={data?.dailyGoal ?? 10} size={124} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Meta diária</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(data?.todayCount ?? 0) >= (data?.dailyGoal ?? 10)
                        ? 'Meta batida! Sequência garantida por hoje.'
                        : `Faltam ${Math.max(0, (data?.dailyGoal ?? 10) - (data?.todayCount ?? 0))} questões para manter a sequência.`}
                    </p>
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <Link href="/revisao">
                        <Repeat className="h-3.5 w-3.5" />
                        {data?.dueCount ? `${data.dueCount} para revisar` : 'Revisar'}
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <StatCard
            label="Nível"
            value={loading ? '—' : level}
            hint={loading ? undefined : getLevelName(level)}
            icon={Trophy}
            tone="primary"
          />

          <StatCard
            label="Ofensiva"
            value={loading ? '—' : `${user?.streak ?? 0} dias`}
            hint={
              loading
                ? undefined
                : `Melhor sequência: ${user?.bestStreak ?? user?.streak ?? 0} dias`
            }
            icon={Flame}
            tone={(user?.streak ?? 0) > 0 ? 'warning' : 'default'}
          />

          <StatCard
            label="Precisão"
            value={loading ? '—' : `${data?.accuracyRate ?? 0}%`}
            hint={loading ? undefined : `${data?.totalCorrect ?? 0} de ${data?.totalQuestions ?? 0} questões`}
            icon={Target}
            tone={(data?.accuracyRate ?? 0) >= 70 ? 'success' : 'default'}
          />

          <StatCard
            label="XP total"
            value={loading ? '—' : (user?.xp ?? 0)}
            hint={loading ? undefined : `${Math.max(0, xpNext - (user?.xp ?? 0))} para o nível ${level + 1}`}
            icon={Zap}
          />

          <StatCard
            label="Dominadas"
            value={loading ? '—' : (data?.masteredCount ?? 0)}
            hint="Questões consolidadas na revisão"
            icon={Repeat}
            tone="success"
          />
        </div>
      </div>

      {/* Progresso de nível */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Progresso de nível</CardTitle>
            <span className="tabular text-xs text-muted-foreground">
              {user?.xp ?? 0} / {xpNext} XP
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={xpProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Nível {level} · {getLevelName(level)}
            </span>
            <span>Nível {level + 1}</span>
          </div>
        </CardContent>
      </Card>

      {/* Linha 2: atividade + ofensiva */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Atividade</CardTitle>
              <CardDescription>Acertos e erros por dia</CardDescription>
            </div>
            <Tabs value={range} onValueChange={(v) => setRange(v as '7' | '30')}>
              <TabsList className="h-8">
                <TabsTrigger value="7" className="px-2.5 text-xs">
                  7d
                </TabsTrigger>
                <TabsTrigger value="30" className="px-2.5 text-xs">
                  30d
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[220px]" />
            ) : rangedDaily.some((d) => d.total > 0) ? (
              <ActivityChart data={rangedDaily} />
            ) : (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhuma questão respondida nos últimos {range} dias.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href="/practice/matematica">Começar a praticar</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Precisão por matéria</CardTitle>
            <CardDescription>Percentual de acerto acumulado</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[220px]" />
            ) : accuracyBySubject.length > 0 ? (
              <AccuracyBySubjectChart data={accuracyBySubject} />
            ) : (
              <div className="flex h-[220px] items-center justify-center">
                <p className="text-sm text-muted-foreground">Sem dados suficientes ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ofensiva */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Calendário de estudos</CardTitle>
          <CardDescription>Últimos 6 meses de atividade</CardDescription>
        </CardHeader>
        <CardContent>
          {heatmapLoading ? (
            <div className="h-[120px]" />
          ) : (
            <StreakHeatmap cells={heatmap} />
          )}
        </CardContent>
      </Card>

      {/* XP acumulado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evolução de XP</CardTitle>
          <CardDescription>XP acumulado no período</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[200px]" />
          ) : rangedDaily.length > 0 ? (
            <XpProgressChart data={rangedDaily} />
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">Sem dados no período.</p>
          )}
        </CardContent>
      </Card>

      {/* Linha 3: desempenho por assunto + conquistas */}
      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Desempenho por assunto</CardTitle>
              <CardDescription>Onde você está forte e onde revisar</CardDescription>
            </div>
            <Badge variant="outline">{data?.performances.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <SkeletonList rows={3} />}

            {!loading && (data?.performances.length ?? 0) === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ainda não há registros de desempenho. Responda algumas questões para ver a análise.
              </p>
            )}

            {!loading &&
              (data?.performances ?? []).slice(0, 6).map((item) => {
                const pct =
                  item.totalQuestions > 0
                    ? Math.round((item.correctAnswers / item.totalQuestions) * 100)
                    : 0;
                return (
                  <div
                    key={`${item.subject}-${item.topic}`}
                    className="rounded-lg border border-border p-3 transition-colors hover:border-primary/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{getTopicLabel(item.topic)}</p>
                        <p className="text-xs text-muted-foreground">
                          {getSubjectLabel(item.subject)} · {item.correctAnswers}/{item.totalQuestions} acertos
                          {item.avgTimeSpent > 0 && ` · ~${Math.round(item.avgTimeSpent)}s`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="tabular text-sm font-semibold">{pct}%</span>
                        <ArrowUpRight
                          className={
                            pct >= 80
                              ? 'h-4 w-4 text-success'
                              : pct >= 50
                                ? 'h-4 w-4 text-warning'
                                : 'h-4 w-4 text-destructive'
                          }
                        />
                      </div>
                    </div>
                    <Progress
                      value={pct}
                      className="mt-2 h-1"
                      indicatorClassName={
                        pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive'
                      }
                    />
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Conquistas</CardTitle>
              <CardDescription>Desbloqueadas recentemente</CardDescription>
            </div>
            <Trophy className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <SkeletonList rows={2} />}

            {!loading && (data?.achievements.length ?? 0) === 0 && (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhuma conquista ainda. Elas vêm com a prática.
                </p>
              </div>
            )}

            {!loading &&
              (data?.achievements ?? []).slice(0, 5).map((achievement) => (
                <div key={achievement.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/12 text-lg">
                    {achievement.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{achievement.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      +{achievement.xpReward} XP · {formatRelative(achievement.unlockedAt)}
                    </p>
                  </div>
                </div>
              ))}

            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/perfil">
                <CalendarClock className="h-3.5 w-3.5" />
                Ver todas
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
