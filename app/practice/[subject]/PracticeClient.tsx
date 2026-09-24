'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronLeft,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  Wand2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { QuestionCard, ExplanationPanel, type QuestionOption } from '@/components/shared/QuestionCard';
import { useToast } from '@/components/ui/use-toast';
import { invalidateUserStats, useUserStats } from '@/lib/hooks/use-user-stats';
import { cn, getDifficultyLabel } from '@/lib/utils';
import { DIFFICULTIES } from '@/lib/subjects';

type Subject = {
  id: string;
  label: string;
  icon: string;
  topics: Array<{ id: string; label: string }>;
};

type Difficulty = 'easy' | 'medium' | 'hard' | 'challenge';

type Question = {
  id: string;
  subject: string;
  topic: string;
  difficulty: string;
  question: string;
  options: QuestionOption[];
};

type AnswerResult = {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  stepByStep: string[];
  xpGained: number;
  newXp: number;
  newLevel: number;
  newStreak: number;
  nextReview: string;
  todayCount: number;
  dailyGoal: number;
  grantedAchievements: Array<{ code: string; name: string; icon: string; xpReward: number }>;
};

type SessionStats = { answered: number; correct: number; xp: number };

const EMPTY_SESSION: SessionStats = { answered: 0, correct: 0, xp: 0 };

export function PracticeClient({
  subject,
  initialTopic,
}: {
  subject: Subject;
  initialTopic?: string;
}) {
  const { toast } = useToast();
  const { data: stats } = useUserStats();

  const [topic, setTopic] = useState<string | null>(initialTopic ?? null);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [session, setSession] = useState<SessionStats>(EMPTY_SESSION);

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);

  const [simplerExplanation, setSimplerExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState<null | 'simpler' | 'different'>(null);

  const startedAt = useRef<number>(Date.now());

  const performanceByTopic = new Map(
    (stats?.performances ?? [])
      .filter((p) => p.subject === subject.id)
      .map((p) => [p.topic, p]),
  );

  const resetQuestionState = () => {
    setQuestion(null);
    setSelected(null);
    setResult(null);
    setSimplerExplanation(null);
    setError(null);
  };

  const loadQuestion = useCallback(
    async (topicId: string, level: Difficulty) => {
      setLoading(true);
      setError(null);
      setSelected(null);
      setResult(null);
      setSimplerExplanation(null);

      try {
        const res = await fetch('/api/ai/generate-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: subject.id, topic: topicId, difficulty: level }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError({
            message: data.error ?? 'Não foi possível gerar a questão.',
            retry: res.status !== 503,
          });
          setQuestion(null);
          return;
        }

        setQuestion(data as Question);
        startedAt.current = Date.now();
      } catch {
        setError({ message: 'Falha de conexão ao gerar a questão.', retry: true });
        setQuestion(null);
      } finally {
        setLoading(false);
      }
    },
    [subject.id],
  );

  const startPractice = (topicId: string) => {
    setTopic(topicId);
    setSession(EMPTY_SESSION);
    void loadQuestion(topicId, difficulty);
  };

  // Vindo de "Praticar" em Meus Erros: já abre na questão do tópico.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (!initialTopic || bootstrapped.current) return;
    bootstrapped.current = true;
    void loadQuestion(initialTopic, difficulty);
  }, [initialTopic, difficulty, loadQuestion]);

  const confirmAnswer = async () => {
    if (!question || !selected || checking || result) return;

    setChecking(true);
    try {
      const res = await fetch('/api/ai/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          userAnswer: selected,
          timeSpent: Math.min(3600, Math.round((Date.now() - startedAt.current) / 1000)),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Erro ao corrigir',
          description: data.error ?? 'Tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      const answer = data as AnswerResult;
      setResult(answer);
      setSession((prev) => ({
        answered: prev.answered + 1,
        correct: prev.correct + (answer.isCorrect ? 1 : 0),
        xp: prev.xp + answer.xpGained,
      }));

      // Sidebar/dashboard leem do cache compartilhado.
      invalidateUserStats();

      (answer.grantedAchievements ?? []).forEach((achievement) => {
        toast({
          title: `${achievement.icon} ${achievement.name}`,
          description: `Conquista desbloqueada · +${achievement.xpReward} XP`,
        });
      });
    } catch {
      toast({
        title: 'Erro ao corrigir',
        description: 'Falha de conexão. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
    }
  };

  const askForExplanation = async (style: 'simpler' | 'different') => {
    if (!question) return;
    setExplaining(style);
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, style, userAnswer: selected ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSimplerExplanation(data.explanation);
    } catch (e) {
      toast({
        title: 'Não foi possível gerar a explicação',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setExplaining(null);
    }
  };

  const nextQuestion = () => {
    if (!topic) return;
    void loadQuestion(topic, difficulty);
  };

  // Atalhos de teclado: A–D / 1–4 seleciona, Enter confirma ou avança.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (loading || checking) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        if (result) nextQuestion();
        else void confirmAnswer();
        return;
      }

      if (!question || result) return;

      const byLetter = ['A', 'B', 'C', 'D'][['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase())];
      const byNumber = ['A', 'B', 'C', 'D'][Number(e.key) - 1];
      const picked = byLetter ?? byNumber;

      if (picked && question.options.some((o) => o.key === picked)) {
        e.preventDefault();
        setSelected(picked);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const accuracy = session.answered > 0 ? Math.round((session.correct / session.answered) * 100) : 0;
  const todayProgress =
    result && result.dailyGoal > 0 ? Math.min(100, (result.todayCount / result.dailyGoal) * 100) : null;

  // ---------- Seletor de tópicos ----------
  if (!topic) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Praticar ${subject.label}`}
          description="Escolha um tópico e responda questões geradas na hora, com correção e resolução."
          icon={() => <span className="text-lg">{subject.icon}</span>}
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dificuldade
          </span>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDifficulty(d.id as Difficulty)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                difficulty === d.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subject.topics.map((t) => {
            const perf = performanceByTopic.get(t.id);
            const pct =
              perf && perf.totalQuestions > 0
                ? Math.round((perf.correctAnswers / perf.totalQuestions) * 100)
                : null;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => startPractice(t.id)}
                className="group flex h-full flex-col justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-accent/40"
              >
                <div>
                  <p className="font-medium">{t.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {perf
                      ? `${perf.correctAnswers}/${perf.totalQuestions} acertos${
                          perf.avgTimeSpent > 0 ? ` · ~${Math.round(perf.avgTimeSpent)}s por questão` : ''
                        }`
                      : 'Ainda não praticado'}
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {pct !== null ? (
                    <>
                      <Progress
                        value={pct}
                        className="h-1 flex-1"
                        indicatorClassName={pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive'}
                      />
                      <span className="tabular text-xs font-medium text-muted-foreground">{pct}%</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/70">Começar</span>
                  )}
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- Sessão ----------
  const topicLabel = subject.topics.find((t) => t.id === topic)?.label ?? topic;

  return (
    <div className="space-y-5">
      <PageHeader
        title={topicLabel}
        description={`${subject.label} · ${getDifficultyLabel(difficulty)}`}
      >
        <Button variant="ghost" size="sm" onClick={() => { setTopic(null); resetQuestionState(); }}>
          <ChevronLeft className="h-4 w-4" />
          Tópicos
        </Button>
      </PageHeader>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Respondidas" value={session.answered} />
        <StatCard
          label="Acertos"
          value={`${session.correct}${session.answered > 0 ? ` (${accuracy}%)` : ''}`}
          tone={accuracy >= 70 ? 'success' : undefined}
        />
        <StatCard label="XP na sessão" value={session.xp} tone="primary" icon={Zap} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error.message}</span>
            {error.retry && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadQuestion(topic, difficulty)}
              >
                Tentar novamente
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-20">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Gerando questão inédita…</p>
        </div>
      )}

      {!loading && question && (
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <QuestionCard
              subject={question.subject}
              topic={question.topic}
              difficulty={question.difficulty}
              question={question.question}
              options={question.options}
              selected={selected}
              onSelect={setSelected}
              revealed={Boolean(result)}
              correctAnswer={result?.correctAnswer}
              footer={
                result ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {result.isCorrect ? `+${result.xpGained} XP` : `+${result.xpGained} XP pela tentativa`}
                      {' · '}
                      volta {result.nextReview}
                    </span>
                    <Button size="sm" onClick={nextQuestion}>
                      Próxima questão
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">
                      Atalhos: A–D ou 1–4 · Enter para confirmar
                    </span>
                    <Button
                      size="sm"
                      onClick={() => void confirmAnswer()}
                      disabled={!selected}
                      loading={checking}
                    >
                      {checking ? 'Corrigindo…' : 'Confirmar resposta'}
                    </Button>
                  </>
                )
              }
            >
              {result && (
                <div className="space-y-3">
                  <ExplanationPanel
                    isCorrect={result.isCorrect}
                    correctAnswer={result.correctAnswer}
                    explanation={result.explanation}
                    stepByStep={result.stepByStep}
                  >
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void askForExplanation('simpler')}
                        loading={explaining === 'simpler'}
                      >
                        {explaining !== 'simpler' && <Lightbulb className="h-3.5 w-3.5" />}
                        Explicar mais simples
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void askForExplanation('different')}
                        loading={explaining === 'different'}
                      >
                        {explaining !== 'different' && <Wand2 className="h-3.5 w-3.5" />}
                        Outra abordagem
                      </Button>
                    </div>

                    {simplerExplanation && (
                      <div className="animate-fade-up mt-2 space-y-1 rounded-lg border border-border bg-card p-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          Professor IA
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{simplerExplanation}</p>
                      </div>
                    )}
                  </ExplanationPanel>

                  {todayProgress !== null && (
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Target className="h-3.5 w-3.5 text-primary" />
                          Meta diária
                        </span>
                        <span className="tabular text-muted-foreground">
                          {result.todayCount}/{result.dailyGoal}
                        </span>
                      </div>
                      <Progress
                        value={todayProgress}
                        className="mt-2 h-1.5"
                        indicatorClassName={todayProgress >= 100 ? 'bg-success' : undefined}
                      />
                    </div>
                  )}
                </div>
              )}
            </QuestionCard>
          </motion.div>
        </AnimatePresence>
      )}

      {!loading && !question && !error && (
        <EmptyState
          icon={Target}
          title="Pronto para começar"
          description={`Gere a primeira questão de ${topicLabel}.`}
        >
          <Button onClick={() => void loadQuestion(topic, difficulty)}>
            <Sparkles className="h-4 w-4" />
            Gerar questão
          </Button>
        </EmptyState>
      )}

      {session.answered > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Trophy className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium">
                Sessão: {session.correct} de {session.answered} ({accuracy}%)
              </p>
              <p className="text-xs text-muted-foreground">
                {session.answered >= 10 ? 'Bom ritmo — continue assim.' : 'Continue praticando para fixar.'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSession(EMPTY_SESSION)}>
            <RotateCcw className="h-3.5 w-3.5" />
            Zerar contagem
          </Button>
        </div>
      )}
    </div>
  );
}
