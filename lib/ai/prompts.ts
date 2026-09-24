import { SUBJECTS } from '../subjects';

interface QuestionPromptParams {
  subject: string;
  topic: string;
  difficulty: string;
  recentTopics?: string[];
  recentQuestions?: string[];
}

export function buildQuestionPrompt(params: QuestionPromptParams): string {
  const { subject, topic, difficulty, recentTopics = [], recentQuestions = [] } = params;
  
  const subjectData = SUBJECTS.find(s => s.id === subject);
  const subjectLabel = subjectData?.label ?? subject;
  const topicLabel = subjectData?.topics.find(t => t.id === topic)?.label ?? topic;
  
  const difficultyInstructions: Record<string, string> = {
    easy: 'FÁCIL: conceitos básicos, números pequenos, situação do dia a dia simples',
    medium: 'MÉDIO: raciocínio intermediário, mistura de conceitos, contexto variado',
    hard: 'DIFÍCIL: múltiplas etapas, raciocínio avançado, contexto mais complexo',
    challenge: 'DESAFIO: problema complexo, múltiplos conceitos combinados, raciocínio crítico elevado',
  };

  const recentContext = recentQuestions.length > 0
    ? `\n\nQuestões RECENTES já apresentadas ao aluno (EVITE criar enunciados muito similares):\n${recentQuestions.slice(0, 5).map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : '';

  const topicsContext = recentTopics.length > 0
    ? `\n\nContextos/cenários já utilizados recentemente: ${recentTopics.join(', ')}. Use um contexto DIFERENTE.`
    : '';

  return `Você é um professor experiente de ${subjectLabel} criando questões para alunos que se preparam para o vestibular da FIAP (faculdade de tecnologia).

Crie UMA questão ORIGINAL e INÉDITA sobre: ${topicLabel}
Nível de dificuldade: ${difficultyInstructions[difficulty] ?? difficulty}

Regras OBRIGATÓRIAS:
1. A questão deve ter EXATAMENTE 4 alternativas (A, B, C, D)
2. Deve existir APENAS UMA resposta correta
3. As alternativas erradas devem ser plausíveis mas claramente incorretas
4. Para matemática: VERIFIQUE os cálculos antes de finalizar
5. Para matemática: use números e contextos diferentes dos exemplos comuns
6. O enunciado deve ser claro e sem ambiguidade
7. Varie o contexto: tecnologia, cotidiano, esportes, culinária, viagens, etc.
8. A questão deve ser adequada para estudantes do ensino médio${recentContext}${topicsContext}

Retorne APENAS o JSON abaixo, sem texto adicional, sem markdown:
{
  "subject": "${subject}",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "question": "enunciado completo da questão aqui",
  "options": [
    {"key": "A", "text": "primeira alternativa"},
    {"key": "B", "text": "segunda alternativa"},
    {"key": "C", "text": "terceira alternativa"},
    {"key": "D", "text": "quarta alternativa"}
  ],
  "answer": "A",
  "explanation": "Explicação didática e clara do porquê esta é a resposta correta",
  "stepByStep": [
    "Passo 1: descrição do primeiro passo",
    "Passo 2: descrição do segundo passo",
    "Passo 3: descrição do terceiro passo"
  ],
  "concept": "Conceito principal utilizado nesta questão",
  "contextTag": "tag curta descrevendo o contexto (ex: 'mercado', 'escola', 'tecnologia')"
}`;
}

export function buildEssayGradePrompt(theme: string, content: string): string {
  return `Você é um professor especializado em correção de redações para vestibulares.

Corrija a redação abaixo com CUIDADO e DIDÁTICA. Seu objetivo é ENSINAR o aluno a melhorar, não apenas dar uma nota.

TEMA DA REDAÇÃO: "${theme}"

REDAÇÃO DO ALUNO:
${content}

Avalie a redação nos seguintes critérios (0 a 200 pontos cada, total máximo 1000):
1. TEMA (themeScore): O aluno abordou corretamente o tema? Manteve foco?
2. ESTRUTURA (structureScore): Há introdução, desenvolvimento e conclusão? Estão bem definidos?
3. COESÃO E COERÊNCIA (cohesionScore): O texto flui bem? As ideias se conectam logicamente?
4. ARGUMENTAÇÃO (argumentScore): Os argumentos são sólidos e bem desenvolvidos?
5. GRAMÁTICA E ORTOGRAFIA (grammarScore): Há erros gramaticais, ortográficos ou de pontuação?

Retorne APENAS o JSON abaixo, sem markdown:
{
  "totalScore": 0,
  "themeScore": 0,
  "structureScore": 0,
  "cohesionScore": 0,
  "argumentScore": 0,
  "grammarScore": 0,
  "feedback": "Feedback geral sobre a redação (2-3 parágrafos didáticos)",
  "highlights": [
    {"type": "error", "text": "trecho problemático", "comment": "explicação do problema"},
    {"type": "positive", "text": "trecho positivo", "comment": "por que está bom"}
  ],
  "suggestions": [
    "Sugestão específica de melhoria 1",
    "Sugestão específica de melhoria 2",
    "Sugestão específica de melhoria 3"
  ],
  "positives": [
    "Ponto positivo 1",
    "Ponto positivo 2"
  ],
  "needsWork": [
    "Aspecto que precisa de desenvolvimento 1",
    "Aspecto que precisa de desenvolvimento 2"
  ]
}`;
}

export function buildTutorSystemPrompt(studentName: string, performanceSummary: string): string {
  return `Você é o Professor IA da plataforma de estudos FIAP Prep — um tutor virtual experiente, didático e encorajador.

Você está ajudando o(a) aluno(a) ${studentName} a se preparar para o processo seletivo da FIAP.

Desempenho atual do(a) aluno(a):
${performanceSummary}

Suas capacidades:
- Explicar qualquer conteúdo das matérias disponíveis (Matemática e Português)
- Gerar exercícios práticos
- Corrigir e explicar erros
- Criar planos de revisão
- Analisar o desempenho e recomendar estudos

MATÉRIAS DISPONÍVEIS:
- Matemática: Porcentagem, Regra de Três Simples, Regra de Três Composta, Média Aritmética, Problemas Matemáticos, Interpretação de Problemas, Raciocínio Lógico
- Português: Interpretação de Texto, Ortografia, Pontuação, Acentuação, Classes Gramaticais, Substantivos, Verbos, Adjetivos, Pronomes, Sinônimos e Antônimos, Concordância, Formação de Frases, Compreensão Textual

Regras de comportamento:
1. Sempre responda em Português Brasileiro
2. Seja didático e use exemplos práticos
3. Encoraje o aluno quando ele erra
4. Quando criar exercícios, formate claramente com enunciado e alternativas
5. Adapte a linguagem ao nível do aluno (ensino médio)
6. Seja conciso mas completo
7. Use emojis com moderação para tornar a conversa mais amigável`;
}

export function buildStudyPlanPrompt(studentName: string, performances: any[], preferences: any): string {
  return `Você é um especialista em planejamento de estudos para vestibulares.

Crie um plano de estudos personalizado para ${studentName} com base no desempenho abaixo:

${JSON.stringify(performances, null, 2)}

Preferências do aluno:
- Dias disponíveis por semana: ${preferences.daysPerWeek ?? 5}
- Tempo por dia: ${preferences.minutesPerDay ?? 60} minutos

Regras:
1. Priorize as matérias com menor percentual de acerto
2. Alterne entre matérias para evitar fadiga
3. Inclua revisão de erros
4. Seja específico com tópicos
5. Inclua uma redação por semana

Retorne APENAS o JSON:
{
  "weeklyPlan": [
    {
      "day": "Segunda-feira",
      "tasks": [
        {"subject": "matematica", "topic": "porcentagem", "duration": 20, "description": "o que praticar"}
      ]
    }
  ],
  "focus": "Área principal de foco desta semana",
  "motivation": "Mensagem motivacional personalizada",
  "weeklyGoal": "Meta específica para a semana"
}`;
}
