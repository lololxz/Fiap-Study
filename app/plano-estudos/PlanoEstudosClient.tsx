'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Clock,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard } from '@/components/shared/Skeleton';
import { useToast } from '@/components/ui/use-toast';
import { getSubjectLabel, getTopicLabel } from '@/lib/utils';
import { formatDateTime } from '@/lib/format';

type Task = { subject: string; topic: string; duration: number; description: string };
type PlanDay = { day: string; tasks: Task[] };

type Plan = {
  weeklyPlan: PlanDay[];
  focus: string;
  motivation: string;
  weeklyGoal: string;
};

export default function PlanoEstudosClient() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/study-plan');
      const data = await res.json();
      setPlan(data.plan ?? null);
      setGeneratedAt(data.generatedAt ?? null);
      setError(null);
    } catch {
      setError('Não foi possível carregar seu plano.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlan();
  }, [fetchPlan]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/study-plan', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar plano.');

      setPlan(data.plan);
      setGeneratedAt(new Date().toISOString());
      toast({
        title: 'Plano atualizado',
        description: 'A IA analisou seu desempenho e reorganizou a semana.',
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const totalMinutes =
    plan?.weeklyPlan.reduce(
      (sum, day) => sum + day.tasks.reduce((s, t) => s + (t.duration || 0), 0),
      0,
    ) ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Plano de Estudos"
        description="Uma rotina semanal montada a partir do seu desempenho real."
        icon={CalendarDays}
      >
        <Button onClick={() => void generate()} loading={generating} disabled={generating}>
          {!generating && <Sparkles className="h-3.5 w-3.5" />}
          {plan ? 'Gerar novo plano' : 'Gerar plano'}
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void generate()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && !plan && !error && (
        <EmptyState
          icon={Sparkles}
          title="Nenhum plano ativo"
          description="A IA analisa seus acertos por assunto, prioriza o que está mais fraco e monta a semana."
        >
          <Button onClick={() => void generate()} loading={generating}>
            <Sparkles className="h-4 w-4" />
            Gerar meu plano
          </Button>
        </EmptyState>
      )}

      {!loading && plan && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  Foco da semana
                </CardDescription>
                <CardTitle className="text-lg">{plan.focus || 'Equilíbrio entre matérias'}</CardTitle>
              </CardHeader>
              {plan.motivation && (
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{plan.motivation}</p>
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Carga semanal
                </CardDescription>
                <CardTitle className="text-lg">
                  {Math.round(totalMinutes / 60)}h{totalMinutes % 60 > 0 ? `${totalMinutes % 60}min` : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {plan.weeklyGoal && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{plan.weeklyGoal}</p>
                )}
                {generatedAt && (
                  <p className="text-2xs text-muted-foreground">
                    Gerado em {formatDateTime(generatedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {plan.weeklyPlan.map((day, dayIndex) => {
              const minutes = day.tasks.reduce((s, t) => s + (t.duration || 0), 0);
              return (
                <Card key={`${day.day}-${dayIndex}`}>
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-base">{day.day}</CardTitle>
                    <Badge variant="outline">{minutes} min</Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {day.tasks.length === 0 && (
                      <p className="text-sm text-muted-foreground">Dia livre.</p>
                    )}

                    {day.tasks.map((task, i) => (
                      <div
                        key={`${task.subject}-${task.topic}-${i}`}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/30"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary">{getSubjectLabel(task.subject)}</Badge>
                            <Badge variant="outline">{getTopicLabel(task.topic)}</Badge>
                            <span className="tabular text-xs text-muted-foreground">
                              {task.duration} min
                            </span>
                          </div>
                          {task.description && (
                            <p className="mt-1.5 text-sm text-muted-foreground">{task.description}</p>
                          )}
                        </div>

                        <Button asChild size="sm" variant="ghost" className="shrink-0">
                          <Link
                            href={`/practice/${task.subject}?topic=${encodeURIComponent(task.topic)}`}
                          >
                            Praticar
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-center">
            <Button variant="outline" onClick={() => void generate()} loading={generating}>
              {!generating && <RefreshCw className="h-4 w-4" />}
              Recalcular com meu desempenho atual
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
