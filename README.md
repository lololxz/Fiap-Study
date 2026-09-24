# FIAP Prep

Plataforma de estudos para o processo seletivo da FIAP: questões geradas por IA,
simulados, revisão espaçada, correção de redação e um tutor virtual — tudo
amarrado por XP, níveis, ofensiva diária e conquistas.

## Stack

| Camada | Escolha |
|---|---|
| Framework | Next.js 14 (App Router) + React 18 + TypeScript |
| Estilo | Tailwind CSS + primitivos Radix (shadcn/ui) |
| Dados | Prisma 5 + SQLite |
| Auth | NextAuth (Credentials) com sessão JWT + bcrypt |
| IA | Provedor compatível com a API da OpenAI (padrão: XKiro) |
| Gráficos | Recharts |
| Animação | Framer Motion |

## Como rodar

```bash
npm install

# 1. configure o ambiente
cp .env.example .env.local
#    gere um segredo de sessão e cole em NEXTAUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
#    preencha XKIRO_API_KEY (e XKIRO_MODEL) para habilitar os recursos de IA

# 2. banco
npm run db:push     # aplica o schema
npm run db:seed     # cadastra as conquistas

# 3. desenvolvimento
npm run dev
```

Abra <http://localhost:3000>, crie uma conta em `/register`.

### Sobre `.env` e `.env.local`

- **`.env`** — versionado, contém apenas o `DATABASE_URL` local (não é segredo).
  Existe porque o **Prisma CLI lê `.env`, não `.env.local`** — sem ele,
  `db:push`, `db:seed` e `db:studio` falham.
- **`.env.local`** — ignorado pelo git, guarda os segredos. Tem precedência sobre `.env`.

### Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | `prisma generate` + build de produção |
| `npm run start` | Sobe o build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Aplica o schema sem migration (iteração rápida) |
| `npm run db:migrate` | Cria e aplica uma migration |
| `npm run db:deploy` | Aplica migrations pendentes (produção) |
| `npm run db:seed` | Cadastra/atualiza as conquistas |
| `npm run db:studio` | Prisma Studio |

## Funcionalidades

**Praticar** (`/practice/[subject]`) — escolha o tópico e a dificuldade; cada
questão é gerada na hora. Correção com explicação, resolução passo a passo e a
opção de pedir uma explicação mais simples ou uma abordagem diferente ao tutor.
Atalhos: `A–D` ou `1–4` seleciona, `Enter` confirma.

**Simulados** (`/simulado`) — prova configurável (matérias, quantidade,
dificuldade, tempo), com navegação entre questões, cronômetro e revisão completa
no fim. As respostas alimentam histórico, desempenho e revisão espaçada.

**Revisão espaçada** (`/revisao`) — SM-2 simplificado. Acertou: o intervalo
cresce (1d → 3d → 7d → …). Errou: volta para 10 minutos e o item reaparece na
mesma sessão.

**Redação** (`/redacao`) — temas gerados por IA (com lista fixa de reserva) e
correção em 5 competências de 200 pontos, com trechos comentados e histórico de
versões do mesmo tema.

**Professor IA** (`/professor-ia`) — chat com o contexto do seu desempenho
injetado no prompt.

**Plano de Estudos** (`/plano-estudos`) — rotina semanal montada a partir dos
seus acertos por assunto, com atalho direto para praticar cada tarefa.

**Meus Erros** (`/meus-erros`) — tudo que você errou, filtrável por matéria.

**Dashboard** (`/dashboard`) — meta diária, nível, ofensiva, gráficos de
atividade e evolução de XP, calendário de estudos e conquistas.

## Estrutura

```
app/
  api/                 rotas HTTP (todas com guard de sessão)
    ai/                geração de questão, correção, tutor, plano, redação
    review/due         fila da revisão espaçada
    stats/heatmap      atividade por dia
  (páginas)/           uma pasta por tela, com o Client correspondente
components/
  charts/              Recharts, anel de meta e heatmap
  shared/              shell, cabeçalhos, cartões, cartão de questão
  ui/                  primitivos (API no estilo shadcn)
lib/
  ai/                  cliente do provedor, prompts e validadores (zod)
  hooks/               use-user-stats (cache compartilhado)
  achievements.ts      concessão e progresso das conquistas
  srs.ts               agendamento da revisão espaçada
  rate-limit.ts        token bucket em memória
  env.ts               guardas de configuração
prisma/                schema, seed e migrations
```

## Decisões que valem saber

**O gabarito não vai para o cliente antes da resposta.** `/api/ai/generate-question`
devolve a questão sem `answer`/`explanation`/`stepByStep`; eles só chegam depois
de `/api/ai/check-answer`.

**O servidor não confia no cliente.** `check-answer` lê matéria, tópico e
dificuldade do registro da questão, e limita o XP à primeira vez que a questão é
acertada — sem isso dava para inflar conquistas e farmar XP.

**Rotas de IA são limitadas por usuário** (`lib/rate-limit.ts`). O limitador é em
memória: em múltiplas instâncias o limite efetivo é N × configurado. Para
produção séria, troque por Redis.

**Falta de chave de IA não é erro 500.** As rotas devolvem **503** com mensagem
explicativa quando a configuração está ausente, e a geração de temas de redação
cai para uma lista fixa em vez de deixar o aluno sem opção.

**O simulado cria a linha antes de gerar** (`status: 'generating'`) e reporta
quantas questões saíram de fato — a geração pode falhar parcialmente, e o aluno
é avisado. As chamadas de IA rodam com concorrência limitada e timeout.

## Segurança

- `NEXTAUTH_SECRET` assina a sessão. Com a estratégia JWT, quem conhece o valor
  forja um token de qualquer usuário. **Em produção a aplicação se recusa a
  subir** se o segredo estiver ausente, tiver menos de 32 caracteres ou for um
  valor conhecido (`lib/env.ts`).
- Senhas usam bcrypt (custo 12). Login tem rate limit por IP.
- Registro normaliza o e-mail para minúsculas — sem isso `User@x.com` e
  `user@x.com` viram contas distintas.
- Todas as rotas de dados filtram por `userId` da sessão (sem IDOR), e há
  `middleware.ts` protegendo as rotas no servidor.
- **Nunca comite `.env.local`.** Se uma chave de API vazar, revogue no provedor —
  trocar o arquivo não invalida a chave exposta.

## Licença

Projeto acadêmico, sem licença definida.
