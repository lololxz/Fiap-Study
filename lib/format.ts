/** Formatação de datas e números no padrão pt-BR. */

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "hoje", "ontem", "há 3 dias" — para listas de atividade. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfValue = new Date(date);
  startOfValue.setHours(0, 0, 0, 0);

  const days = Math.round(
    (startOfToday.getTime() - startOfValue.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  if (days < 60) return 'há 1 mês';
  return `há ${Math.round(days / 30)} meses`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return value.toLocaleString('pt-BR');
}

export function formatDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes === 0) return `${secs}s`;
  return `${minutes}min ${secs.toString().padStart(2, '0')}s`;
}

export const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];
