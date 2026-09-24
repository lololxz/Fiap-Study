import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const achievements = [
    { code: 'FIRST_QUESTION', name: 'Primeira Questão', description: 'Respondeu sua primeira questão', icon: '🎯', xpReward: 50, category: 'milestone' },
    { code: 'TEN_QUESTIONS', name: '10 Questões', description: 'Respondeu 10 questões', icon: '⭐', xpReward: 100, category: 'milestone' },
    { code: 'FIFTY_QUESTIONS', name: '50 Questões', description: 'Respondeu 50 questões', icon: '🌟', xpReward: 250, category: 'milestone' },
    { code: 'HUNDRED_QUESTIONS', name: '100 Questões', description: 'Respondeu 100 questões', icon: '💯', xpReward: 500, category: 'milestone' },
    { code: 'FIRST_SIMULADO', name: 'Primeiro Simulado', description: 'Completou seu primeiro simulado', icon: '📝', xpReward: 150, category: 'simulado' },
    { code: 'PERFECT_SIMULADO', name: 'Simulado Perfeito', description: 'Acertou 100% em um simulado', icon: '🏆', xpReward: 500, category: 'simulado' },
    { code: 'FIRST_ESSAY', name: 'Primeira Redação', description: 'Escreveu sua primeira redação', icon: '✍️', xpReward: 100, category: 'essay' },
    { code: 'STREAK_3', name: '3 Dias Seguidos', description: 'Estudou 3 dias consecutivos', icon: '🔥', xpReward: 150, category: 'streak' },
    { code: 'STREAK_7', name: '1 Semana Seguida', description: 'Estudou 7 dias consecutivos', icon: '🔥🔥', xpReward: 350, category: 'streak' },
    { code: 'STREAK_14', name: 'Duas Semanas', description: 'Estudou 14 dias consecutivos', icon: '🔥🔥🔥', xpReward: 600, category: 'streak' },
    { code: 'STREAK_30', name: 'Mês Dedicado', description: 'Estudou 30 dias consecutivos', icon: '🏔️', xpReward: 1000, category: 'streak' },
    { code: 'PERFECT_SCORE', name: 'Nota Máxima', description: 'Acertou 10 questões consecutivas', icon: '💎', xpReward: 300, category: 'performance' },
    { code: 'MATH_MASTER', name: 'Mestre da Matemática', description: 'Acertou 50 questões de Matemática', icon: '🧮', xpReward: 400, category: 'subject' },
    { code: 'PORTUGUESE_MASTER', name: 'Mestre do Português', description: 'Acertou 50 questões de Português', icon: '📚', xpReward: 400, category: 'subject' },
    { code: 'AI_TUTOR', name: 'Aluno Curioso', description: 'Conversou com o Professor IA pela primeira vez', icon: '🤖', xpReward: 75, category: 'engagement' },
    { code: 'STUDY_PLAN', name: 'Planejador', description: 'Criou seu primeiro plano de estudos', icon: '📅', xpReward: 100, category: 'engagement' },
    { code: 'ERROR_REVIEW', name: 'Persistente', description: 'Revisou seus erros pela primeira vez', icon: '💪', xpReward: 100, category: 'engagement' },
    { code: 'FIRST_REVIEW', name: 'Revisor', description: 'Reencontrou uma questão na revisão espaçada', icon: '🔁', xpReward: 75, category: 'review' },
    { code: 'REVIEW_50', name: 'Memória de Ferro', description: 'Consolidou 50 questões na revisão espaçada', icon: '🧠', xpReward: 300, category: 'review' },
    { code: 'REVIEW_100', name: 'Revisão Mestra', description: 'Consolidou 100 questões na revisão espaçada', icon: '🗿', xpReward: 500, category: 'review' },
    { code: 'DAILY_GOAL', name: 'Meta Batida', description: 'Bateu sua meta diária de questões', icon: '🎯', xpReward: 100, category: 'engagement' },
    { code: 'HIGH_ACCURACY', name: 'Alta Precisão', description: 'Atingiu 80% de acerto em uma matéria', icon: '🎖️', xpReward: 300, category: 'performance' },
    { code: 'LEVEL_5', name: 'Nível 5', description: 'Alcançou o nível 5', icon: '⬆️', xpReward: 200, category: 'level' },
    { code: 'LEVEL_10', name: 'Nível 10', description: 'Alcançou o nível 10', icon: '🚀', xpReward: 500, category: 'level' },
    { code: 'ESSAY_900', name: 'Redação Excelente', description: 'Tirou mais de 900 pontos em uma redação', icon: '🏅', xpReward: 400, category: 'essay' },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      update: {},
      create: achievement,
    });
  }

  console.log('Seed completed: achievements created');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
