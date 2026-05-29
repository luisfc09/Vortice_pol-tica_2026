// Wrapper fino da edge function agent-chat. Toda a IA + contexto da campanha
// ficam no servidor; aqui só invocamos e tratamos o erro real.

import { supabase } from '@/lib/supabase';
import type { AgentKey } from '@/types';

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AskParams {
  agent: AgentKey;
  campaignId: string;
  messages: AgentMessage[];
  page?: string;
}

export async function askAgent({ agent, campaignId, messages, page }: AskParams): Promise<string> {
  const { data, error } = await supabase.functions.invoke('agent-chat', {
    body: { agent, campaign_id: campaignId, messages, page },
  });
  if (error) {
    // O motivo real vem no corpo da resposta (error.context), não em error.message.
    let reason = error.message;
    const res = (error as { context?: Response }).context;
    if (res && typeof res.text === 'function') {
      try {
        const raw = await res.text();
        if (raw) {
          try {
            reason = (JSON.parse(raw) as { error?: string }).error || raw;
          } catch {
            reason = raw;
          }
        }
      } catch {
        /* mantém error.message */
      }
    }
    throw new Error(reason);
  }
  const payload = data as { ok?: boolean; error?: string; reply?: string };
  if (payload.error) throw new Error(payload.error);
  if (!payload.ok || payload.reply == null) throw new Error('Resposta inválida do agente.');
  return payload.reply;
}
