'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronDown, RotateCcw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonList } from '@/components/shared/Skeleton';
import { cn, getDifficultyLabel, getSubjectLabel, getTopicLabel } from '@/lib/utils';
import { formatRelative } from '@/lib/format';
import { SUBJECTS } from '@/lib/subjects';

type ErrorItem = {
  id: string;
  subject: string;
  topic: string;
  difficulty: string;
  userAnswer: string | null;
  correctAnswer: string;
  question: string;
  options: Array<{ key: string; text: string }>;
  explanation: string;
  stepByStep: string[];
  answeredAt: string;
};

export default function MeusErrosClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [total, setTotal] = useState(0);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = subjectFilter === 'all' ? '/api/errors' : `/api/errors?subject=${subjectFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setErrors(data.errors ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setErrors([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [subjectFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Meus Erros"
        description="Revise o que você errou e volte ao conteúdo pelo caminho certo."
        icon={AlertCircle}
      >
        <Button asChild size="sm" variant="outline">
          <Link href="/revisao">
            <RotateCcw className="h-3.5 w-3.5" />
            Revisão espaçada
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        {[{ id: 'all', label: 'Todas' }, ...SUBJECTS.map((s) => ({ id: s.id, label: s.label }))].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSubjectFilter(s.id)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              subjectFilter === s.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {s.label}
          </button>
        ))}
        {total > 0 && (
          <span className="tabular ml-auto self-center text-xs text-muted-foreground">
            {total} {total === 1 ? 'erro' : 'erros'}
          </span>
        )}
      </div>

      {loading && <SkeletonList rows={3} />}

      {!loading && errors.length === 0 && (
        <EmptyState
          icon={Sparkles}
          title={subjectFilter === 'all' ? 'Nenhum erro registrado' : 'Nenhum erro nesta matéria'}
          description="Quando você errar uma questão na prática ou no simulado, ela aparece aqui para revisão."
        >
          <Button asChild>
            <Link href="/practice/matematica">Praticar agora</Link>
          </Button>
        </EmptyState>
      )}

      {!loading && errors.length > 0 && (
        <div className="space-y-3">
          {errors.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <Card key={item.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{getSubjectLabel(item.subject)}</Badge>
                      <Badge variant="outline">{getTopicLabel(item.topic)}</Badge>
                      <Badge variant="outline">{getDifficultyLabel(item.difficulty)}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xs text-muted-foreground">
                        {formatRelative(item.answeredAt)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          router.push(`/practice/${item.subject}?topic=${encodeURIComponent(item.topic)}`)
                        }
                      >
                        <RotateCcw className="h-3 w-3" />
                        Praticar
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm font-medium leading-relaxed">{item.question}</p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-destructive">
                      Sua resposta: <strong>{item.userAnswer || 'em branco'}</strong>
                    </span>
                    <span className="text-success">
                      Correta: <strong>{item.correctAnswer}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {isExpanded ? 'Ocultar resolução' : 'Ver resolução'}
                    <ChevronDown
                      className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')}
                    />
                  </button>

                  {isExpanded && (
                    <div className="animate-fade-up space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                      {item.explanation && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Explicação
                          </p>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {item.explanation}
                          </p>
                        </div>
                      )}

                      {item.stepByStep?.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Passo a passo
                          </p>
                          <ol className="space-y-1">
                            {item.stepByStep.map((step, i) => (
                              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                                <span className="tabular shrink-0 font-medium text-foreground/70">
                                  {i + 1}.
                                </span>
                                <span className="leading-relaxed">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
