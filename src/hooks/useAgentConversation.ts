// Gerencia a conversa com um agente: histórico (sidebar), mensagens da conversa
// atual, envio e persistência em agent_conversations (RLS restringe ao próprio
// usuário). Usado pelo Steve (persistente). Carlos não usa (sem histórico).

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { askAgent, type AgentMessage } from '@/lib/agents/agentChat';
import type { AgentKey } from '@/types';

export interface ConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
}

export function useAgentConversation(agent: AgentKey) {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;
  const userId = session?.id ?? null;

  const [list, setList] = useState<ConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!campaignId) {
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    const { data, error } = await supabase
      .from('agent_conversations')
      .select('id, title, updated_at')
      .eq('campaign_id', campaignId)
      .eq('agent_key', agent)
      .order('updated_at', { ascending: false });
    setLoadingList(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setList((data ?? []) as ConversationSummary[]);
  }, [campaignId, agent]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const selectConversation = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('agent_conversations')
      .select('id, messages')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    setConversationId(id);
    setMessages((data?.messages as AgentMessage[]) ?? []);
    setError(null);
  }, []);

  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending || !campaignId || !userId) return;
      const base: AgentMessage[] = [...messages, { role: 'user', content }];
      setMessages(base);
      setSending(true);
      setError(null);
      try {
        const reply = await askAgent({ agent, campaignId, messages: base });
        const full: AgentMessage[] = [...base, { role: 'assistant', content: reply }];
        setMessages(full);

        const title = (full.find((m) => m.role === 'user')?.content ?? '').slice(0, 60);
        if (conversationId) {
          await supabase
            .from('agent_conversations')
            .update({ messages: full, updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        } else {
          const { data } = await supabase
            .from('agent_conversations')
            .insert({ campaign_id: campaignId, agent_key: agent, user_id: userId, title, messages: full })
            .select('id')
            .maybeSingle();
          if (data?.id) setConversationId(data.id as string);
        }
        void loadList();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao falar com o agente.';
        setError(msg);
        toast.error(msg);
        // Mantém a mensagem do usuário visível (base) para retry manual.
      } finally {
        setSending(false);
      }
    },
    [agent, campaignId, userId, messages, conversationId, sending, loadList],
  );

  return {
    list,
    loadingList,
    conversationId,
    messages,
    sending,
    error,
    send,
    newConversation,
    selectConversation,
  };
}
