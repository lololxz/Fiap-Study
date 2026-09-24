export const SUBJECTS = [
  {
    id: 'matematica',
    label: 'Matemática',
    icon: '🔢',
    color: 'from-blue-500 to-blue-700',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    textColor: 'text-blue-700 dark:text-blue-300',
    topics: [
      { id: 'porcentagem', label: 'Porcentagem' },
      { id: 'regra-tres-simples', label: 'Regra de Três Simples' },
      { id: 'regra-tres-composta', label: 'Regra de Três Composta' },
      { id: 'media-aritmetica', label: 'Média Aritmética' },
      { id: 'problemas-matematicos', label: 'Problemas Matemáticos' },
      { id: 'interpretacao-problemas', label: 'Interpretação de Problemas' },
      { id: 'raciocinio-logico', label: 'Raciocínio Lógico' },
    ],
  },
  {
    id: 'portugues',
    label: 'Português',
    icon: '📚',
    color: 'from-green-500 to-green-700',
    bgColor: 'bg-green-50 dark:bg-green-950',
    textColor: 'text-green-700 dark:text-green-300',
    topics: [
      { id: 'interpretacao-texto', label: 'Interpretação de Texto' },
      { id: 'ortografia', label: 'Ortografia' },
      { id: 'pontuacao', label: 'Pontuação' },
      { id: 'acentuacao', label: 'Acentuação' },
      { id: 'classes-gramaticais', label: 'Classes Gramaticais' },
      { id: 'substantivos', label: 'Substantivos' },
      { id: 'verbos', label: 'Verbos' },
      { id: 'adjetivos', label: 'Adjetivos' },
      { id: 'pronomes', label: 'Pronomes' },
      { id: 'sinonimos-antonimos', label: 'Sinônimos e Antônimos' },
      { id: 'concordancia', label: 'Concordância' },
      { id: 'formacao-frases', label: 'Formação de Frases' },
      { id: 'compreensao-textual', label: 'Compreensão Textual' },
    ],
  },
];

export const DIFFICULTIES = [
  { id: 'easy', label: 'Fácil', color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900' },
  { id: 'medium', label: 'Médio', color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900' },
  { id: 'hard', label: 'Difícil', color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900' },
  { id: 'challenge', label: 'Desafio', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900' },
];

export const ESSAY_CRITERIA = [
  { id: 'themeScore', label: 'Tema', description: 'Atendimento ao tema proposto', maxScore: 200 },
  { id: 'structureScore', label: 'Estrutura', description: 'Organização: introdução, desenvolvimento, conclusão', maxScore: 200 },
  { id: 'cohesionScore', label: 'Coesão e Coerência', description: 'Fluidez do texto e lógica das ideias', maxScore: 200 },
  { id: 'argumentScore', label: 'Argumentação', description: 'Qualidade dos argumentos apresentados', maxScore: 200 },
  { id: 'grammarScore', label: 'Gramática e Ortografia', description: 'Correção gramatical e ortográfica', maxScore: 200 },
];
