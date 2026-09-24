import { z } from 'zod';
import { aiChat, parseJsonLoose, AiUpstreamError } from './client';

export interface EssayTheme {
  title: string;
  description: string;
  category: string;
}

const rawSchema = z.object({
  themes: z
    .array(
      z.object({
        title: z.string().min(3),
        description: z.string().default(''),
        category: z.string().default('sociedade'),
      }),
    )
    .min(1),
});

const PROMPT = `Gere 5 temas de redação adequados para vestibular, relacionados a temas atuais, tecnologia, sociedade e cotidiano.
Retorne APENAS JSON:
{
  "themes": [
    {"title": "Título do tema", "description": "Breve orientação (1-2 frases)", "category": "tecnologia|sociedade|ambiente|educação|saúde"}
  ]
}`;

/** Temas fixos usados quando o provedor de IA não está disponível. */
export const FALLBACK_THEMES: EssayTheme[] = [
  {
    title: 'O impacto da inteligência artificial no mercado de trabalho',
    description: 'Discuta os efeitos da IA na empregabilidade e nas profissões do futuro.',
    category: 'tecnologia',
  },
  {
    title: 'Desafios da educação digital no Brasil',
    description: 'Aborde as oportunidades e os desafios do ensino mediado por tecnologia.',
    category: 'educação',
  },
  {
    title: 'A importância da saúde mental entre jovens',
    description: 'Reflita sobre o crescimento dos transtornos mentais na juventude.',
    category: 'saúde',
  },
  {
    title: 'Cidades sustentáveis e mobilidade urbana',
    description: 'Analise alternativas para o transporte e a ocupação do espaço urbano.',
    category: 'ambiente',
  },
  {
    title: 'Desinformação nas redes sociais',
    description: 'Discuta como as fake news afetam o debate público e a democracia.',
    category: 'sociedade',
  },
];

export async function generateEssayThemes(): Promise<{
  themes: EssayTheme[];
  offline: boolean;
}> {
  try {
    const raw = await aiChat({
      user: PROMPT,
      temperature: 0.9,
      maxTokens: 600,
      json: true,
      timeoutMs: 30_000,
    });

    const parsed = rawSchema.safeParse(parseJsonLoose<unknown>(raw));
    if (!parsed.success) throw new AiUpstreamError('Formato inesperado ao gerar temas.');

    return {
      themes: parsed.data.themes.map((t) => ({
        title: t.title.trim(),
        description: t.description.trim(),
        category: t.category.trim(),
      })),
      offline: false,
    };
  } catch (error) {
    // Os temas são só uma sugestão: se a IA falhar, devolve a lista fixa em vez
    // de deixar o aluno sem opção nenhuma.
    console.error('Geração de temas falhou, usando lista fixa:', error);
    return { themes: FALLBACK_THEMES, offline: true };
  }
}
