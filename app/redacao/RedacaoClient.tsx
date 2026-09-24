'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  History,
  Lightbulb,
  Loader2,
  Send,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonList } from '@/components/shared/Skeleton';
import { useToast } from '@/components/ui/use-toast';
import { invalidateUserStats } from '@/lib/hooks/use-user-stats';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/format';
import { ESSAY_CRITERIA } from '@/lib/subjects';

type Theme = { title: string; description: string; category: string };

type Highlight = { type: 'error' | 'positive'; text: string; comment: string };

type GradeResult = {
  essayId: string;
  gradeId: string;
  version: number;
  wordCount: number;
  totalScore: number;
  themeScore: number;
  structureScore: number;
  cohesionScore: number;
  argumentScore: number;
  grammarScore: number;
  feedback: string;
  highlights: Highlight[];
  suggestions: string[];
  positives: string[];
  needsWork: string[];
  grantedAchievements: Array<{ icon: string; name: string; xpReward: number }>;
};

type EssayHistoryItem = {
  id: string;
  theme: string;
  wordCount: number;
  version: number;
  createdAt: string;
  grades: Array<{ totalScore: number }>;
};

function scoreTone(score: number) {
  const pct = (score / 200) * 100;
  if (pct >= 80) return 'bg-success';
  if (pct >= 50) return 'bg-warning';
  return 'bg-destructive';
}

export default function RedacaoClient() {
  const { toast } = useToast();

  const [theme, setTheme] = useState('');
  const [content, setContent] = useState('');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themesOffline, setThemesOffline] = useState(false);
  const [loadingThemes, setLoadingThemes] = useState(false);

  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<EssayHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchThemes = useCallback(async () => {
    setLoadingThemes(true);
    try {
      const res = await fetch('/api/ai/essay-themes');
      const data = await res.json();
      setThemes(data.themes ?? []);
      setThemesOffline(Boolean(data.offline));
      if (data.themes?.[0] && !theme) setTheme(data.themes[0].title);
    } catch {
      setThemes([]);
    } finally {
      setLoadingThemes(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/essays');
      const data = await res.json();
      setHistory(data.essays ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchThemes();
    void fetchHistory();
  }, [fetchThemes, fetchHistory]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const canSubmit = theme.trim().length >= 5 && wordCount >= 30 && !grading;

  const submitEssay = async () => {
    if (!canSubmit) return;
    setGrading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/ai/grade-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao corrigir redação.');

      setResult(data as GradeResult);
      invalidateUserStats();
      void fetchHistory();

      (data.grantedAchievements ?? []).forEach(
        (achievement: { icon: string; name: string; xpReward: number }) => {
          toast({
            title: `${achievement.icon} ${achievement.name}`,
            description: `Conquista desbloqueada · +${achievement.xpReward} XP`,
          });
        },
      );

      toast({
        title: 'Redação corrigida',
        description: `Nota final: ${data.totalScore}/1000`,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGrading(false);
    }
  };

  const startNewVersion = (item: EssayHistoryItem) => {
    setTheme(item.theme);
    setContent('');
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({
      title: 'Reescrevendo o tema',
      description: 'Sua próxima correção será registrada como uma nova versão deste tema.',
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Laboratório de Redação"
        description="Escreva o texto e receba correção nas 5 competências, com trechos comentados."
        icon={Sparkles}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* Tema */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Tema</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => void fetchThemes()} loading={loadingThemes}>
                {!loadingThemes && <Sparkles className="h-3.5 w-3.5" />}
                Novos temas
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {themesOffline && (
                <Alert variant="warning">
                  <WifiOff className="h-4 w-4" />
                  <AlertDescription>
                    Não foi possível gerar temas por IA agora — mostrando sugestões fixas.
                  </AlertDescription>
                </Alert>
              )}

              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Digite ou escolha um tema…"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              />

              <div className="flex flex-wrap gap-1.5">
                {themes.map((t) => (
                  <button
                    key={t.title}
                    type="button"
                    onClick={() => setTheme(t.title)}
                    title={t.description}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-left text-xs transition-colors',
                      theme === t.title
                        ? 'border-primary bg-primary/10 font-medium text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Texto */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escreva sua redação aqui…"
                rows={16}
                className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm leading-relaxed transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="tabular">
                  {wordCount} palavras
                  {wordCount < 30 && (
                    <span className="ml-2 text-warning">mínimo de 30</span>
                  )}
                </span>
                <Button onClick={() => void submitEssay()} disabled={!canSubmit} loading={grading}>
                  {!grading && <Send className="h-4 w-4" />}
                  {grading ? 'Corrigindo…' : 'Enviar para correção'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Resultado */}
          {result && (
            <Card className="animate-fade-up border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Resultado</CardTitle>
                    <CardDescription>
                      Versão {result.version} · {result.wordCount} palavras
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-3xl font-semibold tracking-tight">
                      {result.totalScore}
                      <span className="text-base font-normal text-muted-foreground">/1000</span>
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {ESSAY_CRITERIA.map((c) => {
                    const score = (result as unknown as Record<string, number>)[c.id] ?? 0;
                    return (
                      <div key={c.id} className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">{c.label}</p>
                        <p className="tabular mt-1 text-lg font-semibold">{score}</p>
                        <Progress
                          value={(score / c.maxScore) * 100}
                          className="mt-1.5 h-1"
                          indicatorClassName={scoreTone(score)}
                        />
                      </div>
                    );
                  })}
                </div>

                {result.feedback && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Parecer geral
                    </p>
                    <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">
                      {result.feedback}
                    </p>
                  </div>
                )}

                {result.highlights.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Trechos comentados
                    </p>
                    <div className="space-y-2">
                      {result.highlights.map((h, i) => (
                        <div
                          key={i}
                          className={cn(
                            'rounded-lg border p-3 text-xs',
                            h.type === 'positive'
                              ? 'border-success/40 bg-success/5'
                              : 'border-destructive/40 bg-destructive/5',
                          )}
                        >
                          <p className="font-medium italic">“{h.text}”</p>
                          <p className="mt-1 text-muted-foreground">{h.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {result.positives.length > 0 && (
                    <div className="rounded-lg border border-success/40 bg-success/5 p-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Pontos positivos
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {result.positives.map((p, i) => (
                          <li key={i}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.needsWork.length > 0 && (
                    <div className="rounded-lg border border-warning/40 bg-warning/8 p-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                        <AlertCircle className="h-3.5 w-3.5" />
                        A desenvolver
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {result.needsWork.map((n, i) => (
                          <li key={i}>• {n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {result.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Lightbulb className="h-3.5 w-3.5 text-warning" />
                      Sugestões
                    </p>
                    <div className="space-y-1.5">
                      {result.suggestions.map((s, i) => (
                        <p key={i} className="rounded-lg border border-border p-2.5 text-xs">
                          {i + 1}. {s}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Critérios</CardTitle>
              <CardDescription>5 competências, 200 pontos cada</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {ESSAY_CRITERIA.map((c) => (
                <div key={c.id} className="rounded-lg bg-muted/40 p-2.5">
                  <p className="text-xs font-medium">{c.label}</p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">{c.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" />
                Suas redações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {historyLoading && <SkeletonList rows={2} />}

              {!historyLoading && history.length === 0 && (
                <EmptyState
                  className="border-0 px-0 py-6"
                  title="Nenhuma redação ainda"
                  description="Sua primeira correção aparece aqui."
                />
              )}

              {!historyLoading &&
                history.slice(0, 6).map((item) => {
                  const score = item.grades?.[0]?.totalScore;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => startNewVersion(item)}
                      className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-xs font-medium">{item.theme}</p>
                        {score !== undefined && (
                          <span
                            className={cn(
                              'tabular shrink-0 text-xs font-semibold',
                              score >= 700 ? 'text-success' : score >= 500 ? 'text-warning' : 'text-destructive',
                            )}
                          >
                            {score}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Badge variant="outline" className="text-2xs">
                          v{item.version}
                        </Badge>
                        <span className="text-2xs text-muted-foreground">
                          {item.wordCount} palavras · {formatRelative(item.createdAt)}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </CardContent>
          </Card>
        </div>
      </div>

      {grading && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card py-6">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            O Professor IA está lendo sua redação…
          </p>
        </div>
      )}
    </div>
  );
}
