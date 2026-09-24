/**
 * SM-2 simplificado para a revisão espaçada.
 *
 * Acerto: 1d → 3d → (intervalo anterior × ease)…
 * Erro:   volta para 10 minutos (para reencontrar a questão na mesma sessão),
 *         incrementa lapses e reduz o ease.
 *
 * `intervalDays` é Float justamente para caber o passo de 10 minutos.
 */

export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;
export const RELEARN_MINUTES = 10;

export type ReviewState = {
  intervalDays: number;
  ease: number;
  repetitions: number;
  lapses: number;
};

export type ReviewOutcome = ReviewState & {
  dueAt: Date;
  /** Etapa legível para exibir na UI ("em 3 dias", "em 10 minutos"). */
  label: string;
};

export function initialReviewState(): ReviewState {
  return { intervalDays: 0, ease: 2.5, repetitions: 0, lapses: 0 };
}

export function scheduleNext(
  state: ReviewState,
  isCorrect: boolean,
  now: Date = new Date(),
): ReviewOutcome {
  let { intervalDays, ease, repetitions, lapses } = state;

  if (!isCorrect) {
    repetitions = 0;
    lapses += 1;
    ease = Math.max(MIN_EASE, ease - 0.2);
    intervalDays = RELEARN_MINUTES / (60 * 24);
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 3;
    } else {
      intervalDays = Math.round(intervalDays * ease * 10) / 10;
    }
    repetitions += 1;
    ease = Math.min(MAX_EASE, ease + 0.1);
  }

  // Teto de ~6 meses para o intervalo não estourar.
  intervalDays = Math.min(intervalDays, 180);

  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    intervalDays,
    ease,
    repetitions,
    lapses,
    dueAt,
    label: formatInterval(intervalDays),
  };
}

export function formatInterval(days: number): string {
  if (days < 1 / 24) return 'em instantes';
  if (days < 1) {
    const minutes = Math.max(1, Math.round(days * 24 * 60));
    return `em ${minutes} min`;
  }
  if (days === 1) return 'amanhã';
  if (days < 30) return `em ${Math.round(days)} dias`;
  if (days < 60) return 'em 1 mês';
  return `em ${Math.round(days / 30)} meses`;
}

/**
 * Uma questão conta como dominada depois de 3 acertos seguidos com
 * intervalo de pelo menos uma semana.
 */
export function isMastered(state: Pick<ReviewState, 'repetitions' | 'intervalDays'>): boolean {
  return state.repetitions >= 3 && state.intervalDays >= 7;
}
