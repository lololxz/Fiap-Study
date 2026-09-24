'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { QuestionCard, type QuestionOption } from '@/components/shared/QuestionCard';
import { useToast } from '@/components/ui/use-toast';
import { invalidateUserStats } from '@/lib/hooks/use-user-stats';
import { cn, getSubjectLabel } from '@/lib/utils';
import { formatDuration } from '@/lib/format';
import { SUBJECTS } from '@/lib/subjects';

type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';

type Question = {
  id: string;
  subject: string;
  topic: string;
  difficulty: string;
  question: string;
  options: QuestionOption[];
};

type ResultRow = {
  questionId: string;
  subject: string;
  topic: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  stepByStep: string[];
};

type FinishResult = {
  score: number;
  correct: number;
  wrong: number;
  total: number;
  timeUsed: number;
  xpGained: number;
  newLevel: number;
  grantedAchievements: Array<{ code: string; name: string; icon: string; xpReward: number }>;
  results: ResultRow[];
};

const PRESETS = [
  { label: 'Rápido', questions: 10, minutes: 15, difficulty: 'mixed' as Difficulty },
  { label: 'Completo', questions: 30, minutes: 45, difficulty: 'mixed' as Difficulty },
];

const DIFFICULTY_OPTIONS: Array<{ id: Difficulty; label: string }> = [
  { id: 'easy', label: 'Fácil' },
  { id: 'medium', label: 'Médio' },
  { id: 'hard', label: 'Difícil' },
  { id: 'mixed', label: 'Misto' },
];

const QUESTION_COUNTS = [5, 10, 15, 20, 30];
const TIME_LIMITS = [10, 15, 30, 45, 60];

export default function SimuladoClient() {
  const { toast } = useToast();
  const [stage, setStage] = useState<'config' | 'running' | 'results'>('config');

  const [totalQuestions, setTotalQuestions] = useState(10);
  const [subjects, setSubjects] = useState<string[]>(['matematica', 'portugues']);
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed');
  const [timeLimit, setTimeLimit] = useState(15);

  const [simuladoId, setSimuladoId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [partialNotice, setPartialNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [results, setResults] = useState<FinishResult | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const toggleSubject = (id: string) => {
    setSubjects((prev) => {
      if (prev.includes(id)) {
        // Pelo menos uma matéria precisa ficar selecionada.
        return prev.length > 1 ? prev.filter((s) => s !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const startSimulado = async () => {
    if (subjects.length === 0) {
      toast({ title: 'Selecione ao menos uma matéria', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setError(null);
    setPartialNotice(null);

    try {
      const res = await fetch('/api/simulados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Simulado (${totalQuestions} questões)`,
          subjects,
          difficulty,
          totalQuestions,
          timeLimit: timeLimit * 60,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao iniciar simulado.');

      setSimuladoId(data.simuladoId);
      setQuestions(data.questions ?? []);
      setAnswers({});
      setCurrentIndex(0);
      setTimeRemaining(timeLimit * 60);
      setStage('running');
      finishingRef.current = false;

      if (data.partial) {
        setPartialNotice(
          `Foram geradas ${data.generated} de ${data.requested} questões — a IA não conseguiu produzir todas.`,
        );
      }

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeRemaining((t) => {
          if (t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            void finishSimulado();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const finishSimulado = async () => {
    if (finishingRef.current || !simuladoId) return;
    finishingRef.current = true;
    setFinishing(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const timeUsed = timeLimit * 60 - timeRemaining;
      const res = await fetch('/api/simulados?action=finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simuladoId, answers, timeUsed: Math.max(0, timeUsed) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao finalizar simulado.');

      setResults(data as FinishResult);
      setStage('results');
      invalidateUserStats();

      (data.grantedAchievements ?? []).forEach(
        (achievement: { icon: string; name: string; xpReward: number }) => {
          toast({
            title: `${achievement.icon} ${achievement.name}`,
            description: `Conquista desbloqueada · +${achievement.xpReward} XP`,
          });
        },
      );
    } catch (e) {
      toast({
        title: 'Erro ao finalizar',
        description: (e as Error).message,
        variant: 'destructive',
      });
      finishingRef.current = false;
    } finally {
      setFinishing(false);
    }
  };

  const current = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  // ---------- Configuração ----------
  if (stage === 'config') {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Simulados"
          description="Uma prova completa gerada na hora, com correção e revisão questão a questão."
          icon={Zap}
        />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurar simulado</CardTitle>
            <CardDescription>Matérias, quantidade de questões e tempo limite</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setTotalQuestions(preset.questions);
                    setTimeLimit(preset.minutes);
                    setDifficulty(preset.difficulty);
                  }}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    totalQuestions === preset.questions && timeLimit === preset.minutes
                      ? 'border-primary bg-primary/8'
                      : 'border-border hover:bg-accent/50',
                  )}
                >
                  <p className="text-sm font-medium">{preset.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {preset.questions} questões · {preset.minutes} min
                  </p>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Matérias
              </p>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSubject(s.id)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      subjects.includes(s.id)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Dificuldade
              </p>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTY_OPTIONS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDifficulty(d.id)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      difficulty === d.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Questões
              </p>
              <div className="flex flex-wrap gap-2">
                {QUESTION_COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTotalQuestions(n)}
                    className={cn(
                      'tabular rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      totalQuestions === n
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tempo limite
              </p>
              <div className="flex flex-wrap gap-2">
                {TIME_LIMITS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeLimit(t)}
                    className={cn(
                      'tabular rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      timeLimit === t
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {t} min
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => void startSimulado()} loading={loading} className="w-full" size="lg">
              {!loading && <Sparkles className="h-4 w-4" />}
              {loading ? 'Gerando prova com IA…' : 'Iniciar simulado'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Em andamento ----------
  if (stage === 'running' && current) {
    const unanswered = questions.length - answeredCount;

    return (
      <div className="space-y-4">
        {partialNotice && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{partialNotice}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-[10rem] flex-1">
            <p className="text-xs text-muted-foreground">
              Questão {currentIndex + 1} de {questions.length}
              {unanswered > 0 && ` · ${unanswered} sem responder`}
            </p>
            <Progress
              value={((currentIndex + 1) / questions.length) * 100}
              className="mt-2 h-1.5"
            />
          </div>

          <div
            className={cn(
              'tabular flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold',
              timeRemaining < 60
                ? 'border-destructive/40 bg-destructive/8 text-destructive'
                : 'border-border text-foreground',
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(timeRemaining)}
          </div>

          <Button variant="destructive" size="sm" onClick={() => void finishSimulado()} disabled={finishing}>
            {finishing ? 'Finalizando…' : 'Finalizar'}
          </Button>
        </div>

        <QuestionCard
          subject={current.subject}
          topic={current.topic}
          difficulty={current.difficulty}
          question={current.question}
          options={current.options}
          selected={answers[current.id] ?? null}
          onSelect={(key) => setAnswers((prev) => ({ ...prev, [current.id]: key }))}
          index={currentIndex}
          total={questions.length}
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
              >
                Anterior
              </Button>

              {currentIndex < questions.length - 1 ? (
                <Button size="sm" onClick={() => setCurrentIndex((i) => i + 1)}>
                  Próxima
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => void finishSimulado()} disabled={finishing} loading={finishing}>
                  Finalizar simulado
                </Button>
              )}
            </>
          }
        />

        {/* Navegação rápida entre questões */}
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIndex(i)}
              aria-label={`Ir para a questão ${i + 1}`}
              className={cn(
                'tabular h-7 w-7 rounded-md border text-xs transition-colors',
                i === currentIndex
                  ? 'border-primary bg-primary text-primary-foreground'
                  : answers[q.id]
                    ? 'border-border bg-accent text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Resultado ----------
  if (stage === 'results' && results) {
    const pct = results.score;

    return (
      <div className="space-y-5">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <span
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-2xl',
                pct >= 70 ? 'bg-success/12 text-success' : pct >= 50 ? 'bg-warning/12 text-warning' : 'bg-destructive/12 text-destructive',
              )}
            >
              <Trophy className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {pct >= 70 ? 'Bom desempenho!' : pct >= 50 ? 'Quase lá' : 'Hora de revisar'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Você acertou {results.correct} de {results.total} questões.
              </p>
            </div>
            <div className="tabular text-4xl font-semibold tracking-tight">{Math.round(pct)}%</div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Acertos" value={results.correct} tone="success" icon={CheckCircle2} />
          <StatCard label="Erros" value={results.wrong} tone={results.wrong > 0 ? 'warning' : 'default'} icon={XCircle} />
          <StatCard label="Tempo" value={formatDuration(results.timeUsed)} />
          <StatCard label="XP ganho" value={`+${results.xpGained}`} tone="primary" icon={Zap} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Revisão das questões</CardTitle>
            <CardDescription>Cada resposta, com a explicação completa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.results.map((r, i) => (
              <div
                key={r.questionId}
                className={cn(
                  'space-y-2 rounded-lg border p-4',
                  r.isCorrect ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="tabular text-xs font-medium text-muted-foreground">
                      {i + 1}.
                    </span>
                    <Badge variant="secondary">{getSubjectLabel(r.subject)}</Badge>
                  </div>
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs font-semibold',
                      r.isCorrect ? 'text-success' : 'text-destructive',
                    )}
                  >
                    {r.isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {r.isCorrect ? 'Acertou' : 'Errou'}
                  </span>
                </div>

                <p className="text-sm font-medium leading-relaxed">{r.question}</p>

                <p className="text-xs text-muted-foreground">
                  Sua resposta: <strong>{r.userAnswer || 'em branco'}</strong> · Correta:{' '}
                  <strong className="text-success">{r.correctAnswer}</strong>
                </p>

                {r.explanation && (
                  <p className="rounded-lg bg-muted/50 p-2.5 text-xs leading-relaxed text-muted-foreground">
                    {r.explanation}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setStage('config');
              setResults(null);
              setQuestions([]);
              setSimuladoId(null);
            }}
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4" />
            Fazer outro simulado
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/meus-erros">
              <AlertTriangle className="h-4 w-4" />
              Ver meus erros
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-20">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Carregando simulado…</p>
    </div>
  );
}
