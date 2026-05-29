import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { ChatMessage } from '@/components/agents/ChatMessage';
import { QuickSuggestions } from '@/components/agents/QuickSuggestions';
import { askAgent, type AgentMessage } from '@/lib/agents/agentChat';
import { supabase } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';

const SUGGESTIONS = [
  'Como importar eleitores?',
  'Como criar um usuário?',
  'Como configurar o Asaas?',
  'Como usar o mapa eleitoral?',
];

// Carlos_AI_Op: botão flutuante + drawer de ajuda em todas as telas do app.
// Não guarda histórico — cada abertura começa do zero (dúvidas pontuais).
export function CarlosDrawer() {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;
  const location = useLocation();
  const [agent, setAgent] = useState<{ name: string; avatar_url: string | null; is_active: boolean }>({
    name: 'Carlos_AI_Op',
    avatar_url: null,
    is_active: true,
  });
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!campaignId) return;
    void (async () => {
      const { data } = await supabase
        .from('ai_agents')
        .select('name, avatar_url, is_active')
        .eq('campaign_id', campaignId)
        .eq('agent_key', 'carlos')
        .maybeSingle();
      if (data) {
        setAgent({
          name: (data.name as string) || 'Carlos_AI_Op',
          avatar_url: data.avatar_url as string | null,
          is_active: data.is_active as boolean,
        });
      }
    })();
  }, [campaignId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Sem histórico: limpa a conversa ao fechar.
      setMessages([]);
      setInput('');
      setError(null);
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending || !campaignId) return;
    const base: AgentMessage[] = [...messages, { role: 'user', content }];
    setMessages(base);
    setInput('');
    setSending(true);
    setError(null);
    try {
      const reply = await askAgent({
        agent: 'carlos',
        campaignId,
        messages: base,
        page: location.pathname,
      });
      setMessages([...base, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao falar com o assistente.');
    } finally {
      setSending(false);
    }
  }

  // Não aparece sem campanha (não há contexto) ou se o agente foi desativado.
  if (!campaignId || !agent.is_active) return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir assistente Carlos"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
          </span>
        </button>
      ) : null}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-[400px]">
          <SheetHeader className="border-b border-vortex-border p-4">
            <div className="flex items-center gap-3">
              <AgentAvatar url={agent.avatar_url} name={agent.name} size={40} />
              <div className="min-w-0">
                <SheetTitle className="text-base">{agent.name}</SheetTitle>
                <SheetDescription className="flex items-center gap-1.5 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Assistente do Vórtice ·
                  online
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="flex items-start gap-2">
              <AgentAvatar url={agent.avatar_url} name={agent.name} size={28} />
              <div className="max-w-[85%] rounded-2xl border border-vortex-border bg-vortex-surface/60 px-3 py-2 text-sm text-foreground/90">
                Olá! Sou o {agent.name}, assistente do Vórtice. Como posso te ajudar?
              </div>
            </div>

            {messages.length === 0 ? (
              <QuickSuggestions items={SUGGESTIONS} onPick={(s) => void send(s)} disabled={sending} />
            ) : (
              messages.map((m, i) => (
                <ChatMessage
                  key={i}
                  message={m}
                  agentName={agent.name}
                  agentAvatar={agent.avatar_url}
                />
              ))
            )}

            {sending ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {agent.name} está digitando…
              </div>
            ) : null}

            {error && !sending ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 border-t border-vortex-border p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Digite sua dúvida…"
              disabled={sending}
            />
            <Button onClick={() => void send(input)} disabled={sending || !input.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
