'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, Loader2, RotateCcw, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';

type Message = { role: 'user' | 'assistant'; content: string };

const GREETING: Message = {
  role: 'assistant',
  content:
    'Olá! Sou seu **Professor IA**. Posso explicar conteúdos, criar exercícios, corrigir seus erros e montar planos de revisão. Por onde quer começar?',
};

const SUGGESTIONS = [
  'Explique porcentagem de forma simples.',
  'Me dê uma questão de regra de três.',
  'Não entendi média aritmética, pode me ensinar?',
  'Crie 3 exercícios de lógica para eu praticar.',
  'Analise meus erros recentes e diga o que revisar.',
];

// O servidor trunca e valida; aqui evitamos mandar um payload grande demais.
const MAX_SENT = 40;

export default function ProfessorIAClient() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || loading) return;

    const next: Message[] = [...messages, { role: 'user', content: value }];
    setMessages(next);
    if (!text) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/tutor-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.slice(-MAX_SENT),
          conversationId: conversationId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao falar com o Professor IA.');

      if (data.conversationId) setConversationId(data.conversationId);
      setMessages([...next, { role: 'assistant', content: data.response }]);
    } catch (e) {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: `Não consegui responder agora: ${(e as Error).message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([GREETING]);
    setConversationId(null);
    setInput('');
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-4">
      <PageHeader
        title="Professor IA"
        description="Tutor disponível 24h, com contexto do seu desempenho."
        icon={Bot}
      >
        <Button variant="outline" size="sm" onClick={reset} disabled={messages.length <= 1}>
          <RotateCcw className="h-3.5 w-3.5" />
          Nova conversa
        </Button>
      </PageHeader>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn('flex gap-2.5', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {m.role === 'assistant' && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Bot className="h-3.5 w-3.5" />
                </span>
              )}

              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'rounded-br-md bg-primary text-primary-foreground'
                    : 'rounded-bl-md border border-border bg-muted/40',
                )}
              >
                {m.role === 'assistant' ? (
                  <div className="prose-sm space-y-2 [&_code]:rounded [&_code]:bg-background [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_li]:ml-4 [&_li]:list-disc [&_ol]:space-y-1 [&_p]:leading-relaxed [&_strong]:font-semibold [&_ul]:space-y-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>

              {m.role === 'user' && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <User className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                <Bot className="h-3.5 w-3.5" />
              </span>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-muted/40 px-4 py-2.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Pensando…</span>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </CardContent>

        {messages.length <= 2 && (
          <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-border p-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                disabled={loading}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex shrink-0 gap-2 border-t border-border p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Pergunte ao Professor IA…"
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={() => void send()} disabled={loading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
