'use client';

import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  cn,
  getDifficultyLabel,
  getSubjectLabel,
  getTopicLabel,
} from '@/lib/utils';

export type QuestionOption = { key: string; text: string };

export function QuestionCard({
  subject,
  topic,
  difficulty,
  question,
  options,
  selected,
  onSelect,
  revealed = false,
  correctAnswer,
  index,
  total,
  headerRight,
  footer,
  children,
  className,
}: {
  subject?: string;
  topic?: string;
  difficulty?: string;
  question: string;
  options: QuestionOption[];
  selected?: string | null;
  onSelect?: (key: string) => void;
  /** Quando true, mostra o gabarito e coloriza as alternativas. */
  revealed?: boolean;
  correctAnswer?: string;
  index?: number;
  total?: number;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-card', className)}>
      {(subject || topic || difficulty || headerRight || index !== undefined) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {index !== undefined && total !== undefined && (
              <span className="tabular text-xs font-medium text-muted-foreground">
                {index + 1} / {total}
              </span>
            )}
            {subject && <Badge variant="secondary">{getSubjectLabel(subject)}</Badge>}
            {topic && <Badge variant="outline">{getTopicLabel(topic)}</Badge>}
            {difficulty && <Badge variant="outline">{getDifficultyLabel(difficulty)}</Badge>}
          </div>
          {headerRight}
        </div>
      )}

      <div className="space-y-4 p-5">
        <p className="text-[0.9375rem] font-medium leading-relaxed">{question}</p>

        <div className="space-y-2">
          {options.map((opt) => {
            const isSelected = selected === opt.key;
            const isCorrect = revealed && correctAnswer === opt.key;
            const isWrongPick = revealed && isSelected && correctAnswer !== opt.key;

            return (
              <button
                key={opt.key}
                type="button"
                disabled={revealed || !onSelect}
                onClick={() => onSelect?.(opt.key)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-3.5 text-left text-sm transition-all',
                  'disabled:cursor-default',
                  !revealed && 'hover:border-primary/50 hover:bg-accent/50',
                  !revealed && isSelected && 'border-primary bg-primary/8',
                  isCorrect && 'border-success bg-success/8',
                  isWrongPick && 'border-destructive bg-destructive/8',
                  revealed && !isCorrect && !isWrongPick && 'border-border opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold',
                    !revealed && isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted/50 text-muted-foreground',
                    isCorrect && 'border-success bg-success text-success-foreground',
                    isWrongPick && 'border-destructive bg-destructive text-destructive-foreground',
                  )}
                >
                  {isCorrect ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : isWrongPick ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    opt.key
                  )}
                </span>
                <span className="leading-relaxed">{opt.text}</span>
              </button>
            );
          })}
        </div>

        {children}
      </div>

      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}

export function ExplanationPanel({
  isCorrect,
  correctAnswer,
  explanation,
  stepByStep,
  children,
}: {
  isCorrect: boolean;
  correctAnswer: string;
  explanation?: string;
  stepByStep?: string[];
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'animate-fade-up space-y-3 rounded-lg border p-4',
        isCorrect ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-white',
            isCorrect ? 'bg-success' : 'bg-destructive',
          )}
        >
          {isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </span>
        <p className="text-sm font-semibold">
          {isCorrect ? 'Resposta correta!' : 'Não foi dessa vez'}
        </p>
        {!isCorrect && (
          <Badge variant="outline" className="ml-auto">
            Gabarito: {correctAnswer}
          </Badge>
        )}
      </div>

      {explanation && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Explicação
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">{explanation}</p>
        </div>
      )}

      {stepByStep && stepByStep.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Passo a passo
          </p>
          <ol className="space-y-1">
            {stepByStep.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="tabular shrink-0 font-medium text-foreground/70">{i + 1}.</span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {children}
    </div>
  );
}
