import { useEffect, useRef, useState } from 'react';
import { Plus, Send, Loader2, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { ChatMessage } from '@/components/agents/ChatMessage';
import { QuickSuggestions } from '@/components/agents/QuickSuggestions';
import { useAgentConversation } from '@/hooks/useAgentConversation';
import { supabase } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Como está minha campanha hoje?',
  'Onde devo focar o campo esta semana?',
  'Analise minhas menções recentes',
  'Quais são os maiores riscos?',
  'Sugira agenda para os próximos 7 dias',
];

export function SteveChat() {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;
  const convo = useAgentConversation('steve');
  const [agent, setAgent] = useState<{ name: string; avatar_url: string | null; is_active: boolean }>({
    name: 'Steve_AI',
    avatar_url: null,
    is_active: true,
  });
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!campaignId) return;
    void (async () => {
      const { data } = await supabase
        .from('ai_agents')
        .select('name, avatar_url, is_active')
        .eq('campaign_id', campaignId)
        .eq('agent_key', 'steve')
        .maybeSingle();
      if (data) {
        setAgent({
          name: (data.name as string) || 'Steve_AI',
          avatar_url: data.avatar_url as string | null,
          is_active: data.is_active as boolean,
        });
      }
    })();
  }, [campaignId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [convo.messages, convo.sending]);

  const blocked = convo.sending || !agent.is_active;

  function submit() {
    const text = input.trim();
    if (!text || blocked) return;
    setInput('');
    void convo.send(text);
  }

  return (
    <div className="flex h-[72vh] overflow-hidden rounded-xl border border-vortex-border bg-vortex-surface/40 backdrop-blur">
      {/* Histórico (sidebar) */}
      <div className="hidden w-60 shrink-0 flex-col border-r border-vortex-border md:flex">
        <div className="p-3">
          <Button variant="outline" className="w-full" onClick={convo.newConversation}>
            <Plus className="h-4 w-4" /> Nova conversa
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {convo.loadingList ? (
            <p className="px-2 text-xs text-muted-foreground">Carregando…</p>
          ) : convo.list.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">Sem conversas ainda.</p>
          ) : (
            convo.list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => convo.selectConversation(c.id)}
                className={cn(
                  'mb-1 flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors',
                  c.id === convo.conversationId
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-vortex-bg/60 hover:text-foreground',
                )}
              >
                <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2">{c.title || 'Conversa'}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {convo.messages.length === 0 ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <AgentAvatar url={agent.avatar_url} name={agent.name} size={32} />
                <div className="max-w-[80%] rounded-2xl border border-vortex-border bg-vortex-surface/60 px-3 py-2 text-sm text-foreground/90">
                  Tenho acesso aos dados atuais da sua campanha. Por onde quer começar?
                </div>
              </div>
              <QuickSuggestions
                items={SUGGESTIONS}
                onPick={(s) => {
                  setInput('');
                  void convo.send(s);
                }}
                disabled={blocked}
              />
            </div>
          ) : (
            convo.messages.map((m, i) => (
              <ChatMessage key={i} message={m} agentName={agent.name} agentAvatar={agent.avatar_url} />
            ))
          )}
          {convo.sending ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AgentAvatar url={agent.avatar_url} name={agent.name} size={24} />
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {agent.name} está analisando…
            </div>
          ) : null}

          {convo.error && !convo.sending ? (
            <div className="flex items-start gap-2">
              <AgentAvatar url={agent.avatar_url} name={agent.name} size={32} />
              <div className="max-w-[80%] space-y-1 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                <p>{convo.error}</p>
                {/nenhuma integra|api_key|habilitada/i.test(convo.error) ? (
                  <p className="text-xs text-red-200/80">
                    Configure uma IA (Anthropic ou OpenAI) em Integrações → Conexões e tente de novo.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {!agent.is_active ? (
          <div className="border-t border-vortex-border bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
            Este agente está desativado. Ative em Integrações → Agentes de IA.
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-vortex-border p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Digite sua pergunta…"
            disabled={blocked}
          />
          <Button onClick={submit} disabled={blocked || !input.trim()}>
            {convo.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
