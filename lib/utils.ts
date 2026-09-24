import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getXpForLevel(level: number): number {
  return level * level * 100;
}

export function getLevelFromXp(xp: number): number {
  let level = 1;
  while (getXpForLevel(level + 1) <= xp) level++;
  return level;
}

export function getLevelName(level: number): string {
  if (level < 5) return 'Iniciante';
  if (level < 10) return 'Explorador';
  if (level < 15) return 'Estudante';
  if (level < 20) return 'Acadêmico';
  if (level < 30) return 'Scholar';
  return 'Mestre';
}

export function getSubjectLabel(subject: string): string {
  const labels: Record<string, string> = {
    matematica: 'Matemática',
    portugues: 'Português',
    redacao: 'Redação',
  };
  return labels[subject] ?? subject;
}

export function getTopicLabel(topic: string): string {
  const labels: Record<string, string> = {
    porcentagem: 'Porcentagem',
    'regra-tres-simples': 'Regra de Três Simples',
    'regra-tres-composta': 'Regra de Três Composta',
    'media-aritmetica': 'Média Aritmética',
    'problemas-matematicos': 'Problemas Matemáticos',
    'interpretacao-problemas': 'Interpretação de Problemas',
    'raciocinio-logico': 'Raciocínio Lógico',
    'interpretacao-texto': 'Interpretação de Texto',
    ortografia: 'Ortografia',
    pontuacao: 'Pontuação',
    acentuacao: 'Acentuação',
    'classes-gramaticais': 'Classes Gramaticais',
    substantivos: 'Substantivos',
    verbos: 'Verbos',
    adjetivos: 'Adjetivos',
    pronomes: 'Pronomes',
    'sinonimos-antonimos': 'Sinônimos e Antônimos',
    concordancia: 'Concordância',
    'formacao-frases': 'Formação de Frases',
    'compreensao-textual': 'Compreensão Textual',
  };
  return labels[topic] ?? topic;
}

export function getDifficultyLabel(difficulty: string): string {
  const labels: Record<string, string> = {
    easy: 'Fácil',
    medium: 'Médio',
    hard: 'Difícil',
    challenge: 'Desafio',
  };
  return labels[difficulty] ?? difficulty;
}

export function getDifficultyColor(difficulty: string): string {
  const colors: Record<string, string> = {
    easy: 'text-green-500',
    medium: 'text-yellow-500',
    hard: 'text-orange-500',
    challenge: 'text-red-500',
  };
  return colors[difficulty] ?? 'text-gray-500';
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getSubjectIcon(subject: string): string {
  const icons: Record<string, string> = {
    matematica: '🔢',
    portugues: '📚',
    redacao: '✍️',
  };
  return icons[subject] ?? '📖';
}

export function getSubjectColor(subject: string): string {
  const colors: Record<string, string> = {
    matematica: 'from-blue-500 to-blue-700',
    portugues: 'from-green-500 to-green-700',
    redacao: 'from-purple-500 to-purple-700',
  };
  return colors[subject] ?? 'from-gray-500 to-gray-700';
}
