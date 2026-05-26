// Wrapper das chamadas server-side ao Módulo de Resposta Rápida.
// Toda inteligência fica na edge function mention-respond — esse client
// apenas formata e invoca.

import { supabase } from '@/lib/supabase';
import type {
  AnaliseMencao,
  Campaign,
  ContextoLegislativo,
  Mention,
  RespostaGerada,
} from '@/types';

export interface AnalyzeResult {
  ok: boolean;
  provider: string;
  model: string;
  analise: AnaliseMencao;
}

export interface GenerateResult {
  ok: boolean;
  provider: string;
  model: string;
  respostas: RespostaGerada[];
}

function candidatePayload(campaign: Campaign) {
  return {
    candidate_name: campaign.candidate_name,
    party: campaign.party,
    party_number: campaign.party_number,
    office: campaign.office,
    state: campaign.state,
  };
}

function mentionPayload(mention: Mention) {
  return {
    content: mention.content,
    source: mention.source,
    author: mention.author,
    published_at: mention.published_at,
    sentiment_score: mention.sentiment_score,
  };
}

export async function analisarMencao(
  mention: Mention,
  campaign: Campaign,
): Promise<AnalyzeResult> {
  const { data, error } = await supabase.functions.invoke('mention-respond', {
    body: {
      mode: 'analyze',
      mention: mentionPayload(mention),
      candidate: candidatePayload(campaign),
    },
  });
  if (error) throw new Error(error.message);
  const payload = data as {
    ok?: boolean;
    error?: string;
    provider?: string;
    model?: string;
    result?: AnaliseMencao;
  };
  if (payload.error) throw new Error(payload.error);
  if (!payload.ok || !payload.result) throw new Error('Resposta inválida da edge function.');
  return {
    ok: true,
    provider: payload.provider ?? 'desconhecido',
    model: payload.model ?? 'desconhecido',
    analise: payload.result,
  };
}

export async function gerarRespostas(
  mention: Mention,
  campaign: Campaign,
  analise: AnaliseMencao,
  contexto: ContextoLegislativo,
): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke('mention-respond', {
    body: {
      mode: 'generate',
      mention: mentionPayload(mention),
      candidate: candidatePayload(campaign),
      analise,
      contexto,
    },
  });
  if (error) throw new Error(error.message);
  const payload = data as {
    ok?: boolean;
    error?: string;
    provider?: string;
    model?: string;
    result?: { respostas: RespostaGerada[] };
  };
  if (payload.error) throw new Error(payload.error);
  if (!payload.ok || !payload.result?.respostas) {
    throw new Error('Resposta inválida da edge function.');
  }
  return {
    ok: true,
    provider: payload.provider ?? 'desconhecido',
    model: payload.model ?? 'desconhecido',
    respostas: payload.result.respostas.map((r) => ({
      ...r,
      caracteres: r.texto?.length ?? r.caracteres ?? 0,
    })),
  };
}
