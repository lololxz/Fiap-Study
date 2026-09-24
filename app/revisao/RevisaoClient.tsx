'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Brain,
  CalendarClock,
  Loader2,
  Repeat,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { QuestionCard, ExplanationPanel, type QuestionOption } from '@/components/shared/QuestionCard';
import { SkeletonList } from '@/components/shared/Skeleton';
import { useToast } from '@/components/ui/use-toast';
import { invalidateUserStats } from '@/lib/hooks/use-user-stats';
import { formatDate } from '@/lib/format';

type ReviewItem = {
  reviewId: string;
  questionId: string;
  subject: string;
  topic: string;
  difficulty: string;
  question: string;
  options: QuestionOption[];
  repetitions: number;
  lapses: number;
  strength: string;
  isLapsed: boolean;
  overdueDays: number;
};

type AnswerResult = {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  stepByStep: string[];
  xpGained: number;
  nextReview: string;
  grantedAchievements: Array<{ code: string; name: string; icon: string; xpReward: number }>;
};

export function RevisaoClient() {
  const { toast } = useToast();

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [totalTracked, setTotalTracked] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [nextDueAt, setNextDueAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [checking, setChecking] = useState(false);

  const [session, setSession] = useState({ answered: 0, correct: 0, xp: 0 });

  const startedAt = useRef<number>(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/review/due?limit=30');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar revisões');

      setItems(data.items ?? []);
      setDueCount(data.dueCount ?? 0);
      setTotalTracked(data.totalTracked ?? 0);
      setMastered(data.mastered ?? 0);
      setNextDueAt(data.nextDueAt ?? null);
      setIndex(0);
      setSelected(null);
      setResult(null);
      setLoadError(null);
      startedAt.current = Date.now();
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const current = items[index];

  const confirm = async () => {
    if (!current || !selected || checking || result) return;
    setChecking(true);
    try {
      const res = await fetch('/api/ai/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: current.questionId,
          userAnswer: selected,
          timeSpent: Math.min(3600, Math.round((Date.now() - startedAt.current) / 1000)),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Erro ao corrigir', description: data.error, variant: 'destructive' });
        return;
      }

      const answer = data as AnswerResult;
      setResult(answer);
      setSession((prev) => ({
        answered: prev.answered + 1,
        correct: prev.correct + (answer.isCorrect ? 1 : 0),
        xp: prev.xp + answer.xpGained,
      }));
      setDueCount((c) => Math.max(0, c - 1));
      invalidateUserStats();

      (answer.grantedAchievements ?? []).forEach((achievement) => {
        toast({
          title: `${achievement.icon} ${achievement.name}`,
          description: `Conquista desbloqueada · +${achievement.xpReward} XP`,
        });
      });
    } catch {
      toast({ title: 'Erro ao corrigir', description: 'Falha de conexão.', variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  };

  const next = () => {
    setSelected(null);
    setResult(null);
    startedAt.current = Date.now();

    if (index + 1 < items.length) {
      setIndex((i) => i + 1);
    } else {
      void load();
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (checking) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        if (result) next();
        else void confirm();
        return;
      }

      if (!current || result) return;
      const byLetter = ['A', 'B', 'C', 'D'][['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase())];
      const byNumber = ['A', 'B', 'C', 'D'][Number(e.key) - 1];
      const picked = byLetter ?? byNumber;
      if (picked && current.options.some((o) => o.key === picked)) {
        e.preventDefault();
        setSelected(picked);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const accuracy = session.answered > 0 ? Math.round((session.correct / session.answered) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Revisão espaçada"
        description="Questões voltam em intervalos crescentes, no ponto em que você está prestes a esquecer."
        icon={Repeat}
      >
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <Repeat className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Para revisar" value={dueCount} tone={dueCount > 0 ? 'primary' : 'default'} />
        <StatCard label="Acompanhadas" value={totalTracked} />
        <StatCard label="Dominadas" value={mastered} tone="success" />
        <StatCard
          label="Nesta sessão"
          value={session.answered > 0 ? `${session.correct}/${session.answered}` : '—'}
          hint={session.answered > 0 ? `${accuracy}% de acerto · ${session.xp} XP` : undefined}
        />
      </div>

      {loading && <SkeletonList rows={2} />}

      {!loading && loadError && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{loadError}</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !loadError && items.length === 0 && (
        <EmptyState
          icon={Sparkles}
          title="Nada para revisar agora"
          description={
            totalTracked === 0
              ? 'Responda questões na prática ou em um simulado. Cada questão entra automaticamente no ciclo de revisão.'
              : nextDueAt
                ? `Sua próxima revisão está marcada para ${formatDate(nextDueAt)}.`
                : 'Você está em dia com todas as revisões.'
          }
        >
          <Button asChild>
            <Link href="/practice/matematica">
              <Brain className="h-4 w-4" />
              Praticar agora
            </Link>
          </Button>
        </EmptyState>
      )}

      {!loading && !loadError && current && (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Item {index + 1} de {items.length}
                </span>
                <span className="tabular">{dueCount} na fila</span>
              </div>
              <Progress
                value={items.length > 0 ? ((index + (result ? 1 : 0)) / items.length) * 100 : 0}
                className="mt-2 h-1"
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {current.isLapsed && <Badge variant="destructive">já errada</Badge>}
              <Badge variant="outline">{current.strength}</Badge>
              {current.repetitions > 0 && (
                <Badge variant="secondary">
                  <Trophy className="h-3 w-3" />
                  {current.repetitions}
                </Badge>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.reviewId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <QuestionCard
                subject={current.subject}
                topic={current.topic}
                difficulty={current.difficulty}
                question={current.question}
                options={current.options}
                selected={selected}
                onSelect={setSelected}
                revealed={Boolean(result)}
                correctAnswer={result?.correctAnswer}
                footer={
                  result ? (
                    <>
                      <span className="text-xs text-muted-foreground">
                        Próxima revisão {result.nextReview}
                        {result.xpGained > 0 && ` · +${result.xpGained} XP`}
                      </span>
                      <Button size="sm" onClick={next}>
                        Próxima
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {current.overdueDays > 0
                          ? `Atrasada há ${current.overdueDays} dia${current.overdueDays === 1 ? '' : 's'}`
                          : 'Atalhos: A–D ou 1–4 · Enter para confirmar'}
                      </span>
                      <Button size="sm" onClick={() => void confirm()} disabled={!selected} loading={checking}>
                        {checking ? 'Corrigindo…' : 'Confirmar resposta'}
                      </Button>
                    </>
                  )
                }
              >
                {result && (
                  <ExplanationPanel
                    isCorrect={result.isCorrect}
                    correctAnswer={result.correctAnswer}
                    explanation={result.explanation}
                    stepByStep={result.stepByStep}
                  />
                )}
              </QuestionCard>
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {!loading && !loadError && !current && items.length > 0 && (
        <EmptyState icon={CalendarClock} title="Fila concluída" description="Você revisou tudo o que estava pendente.">
          <Button onClick={() => void load()}>
            <Loader2 className="h-4 w-4" />
            Verificar novamente
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
