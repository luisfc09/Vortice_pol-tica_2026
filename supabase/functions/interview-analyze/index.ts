// Supabase Edge Function — interview-analyze
//
// Recebe um interview_id, carrega a entrevista completa (respeitando RLS
// via JWT do caller), chama o LLM configurado para a campanha, e devolve
// uma análise estruturada com perfil, argumento-chave e próximos passos.
//
// Deploy: supabase functions deploy interview-analyze
//
// Falha graciosa: se não houver integração de IA ativa, devolve 200 com
// { analysis: null } pra que o frontend não atrapalhe o fluxo de save.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type IntegrationType =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'groq'
  | 'xai'
  | 'deepseek';

interface RequestBody {
  interview_id: string;
}

interface AIAnalysis {
  perfil_resumido: string;
  argumento_chave: string;
  potencial_conversao: 'alto' | 'medio' | 'baixo';
  tags: string[];
  proximo_passo: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const LLM_TYPES: IntegrationType[] = [
  'anthropic',
  'openai',
  'gemini',
  'mistral',
  'groq',
  'xai',
  'deepseek',
];

const DEFAULT_MODELS: Record<IntegrationType, string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-1.5-flash',
  mistral: 'mistral-small-latest',
  groq: 'llama-3.1-70b-versatile',
  xai: 'grok-2-latest',
  deepseek: 'deepseek-chat',
};

// ----------------------------------------------------------------------------
function buildPrompt(interview: Record<string, unknown>, candidate: string) {
  return [
    'Você é analista de campanha eleitoral. Recebe uma entrevista de campo',
    `com um eleitor sobre a candidatura de ${candidate}. Analise objetivamente`,
    'e devolva JSON estrito (sem comentários, sem markdown) no formato:',
    '{',
    '  "perfil_resumido": "frase curta (gênero, faixa etária, religião, renda, intenção)",',
    '  "argumento_chave": "qual argumento mais provavelmente o converte?",',
    '  "potencial_conversao": "alto" | "medio" | "baixo",',
    '  "tags": ["..."],',
    '  "proximo_passo": "ação concreta sugerida ao agente de campo"',
    '}',
    '',
    'Dados da entrevista:',
    JSON.stringify(interview, null, 2),
  ].join('\n');
}

function safeParseJson(text: string): AIAnalysis | null {
  // Remove cercas markdown se vierem
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed.perfil_resumido === 'string' &&
      typeof parsed.argumento_chave === 'string' &&
      typeof parsed.proximo_passo === 'string' &&
      ['alto', 'medio', 'baixo'].includes(parsed.potencial_conversao) &&
      Array.isArray(parsed.tags)
    ) {
      return parsed as AIAnalysis;
    }
    return null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// LLM adapters — versão mínima, só o suficiente pra entrevista
// ----------------------------------------------------------------------------
async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

async function callOpenAiCompatible(
  prompt: string,
  apiKey: string,
  model: string,
  baseUrl: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) {
      return json({ error: 'envs ausentes' }, 500);
    }

    const auth = req.headers.get('authorization') ?? '';
    const callerSb = createClient(url, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const admin = createClient(url, serviceKey);

    const { data: userData } = await callerSb.auth.getUser();
    if (!userData?.user) return json({ error: 'unauthorized' }, 401);

    const body = (await req.json()) as RequestBody;
    if (!body.interview_id) return json({ error: 'interview_id obrigatório' }, 400);

    // Carrega a entrevista respeitando RLS (caller só vê o que pode).
    const { data: interview, error: iErr } = await callerSb
      .from('field_interviews')
      .select('*')
      .eq('id', body.interview_id)
      .single();
    if (iErr || !interview) {
      return json({ error: 'entrevista não encontrada' }, 404);
    }

    // Resolve provider: ai_feature_config (feature: interview_analysis) OU
    // primeira integration LLM ativa da mesma campanha.
    const campaignId = interview.campaign_id;
    const { data: featureCfg } = await admin
      .from('ai_feature_config')
      .select('integration_id, model')
      .eq('campaign_id', campaignId)
      .eq('feature', 'interview_analysis')
      .maybeSingle();

    let providerType: IntegrationType | null = null;
    let apiKey = '';
    let model = '';
    let baseUrl = '';

    if (featureCfg?.integration_id) {
      const { data: integ } = await admin
        .from('integrations')
        .select('type, config')
        .eq('id', featureCfg.integration_id)
        .single();
      if (integ && LLM_TYPES.includes(integ.type as IntegrationType)) {
        providerType = integ.type as IntegrationType;
        apiKey = String((integ.config as Record<string, unknown>)?.api_key ?? '');
        model = featureCfg.model || DEFAULT_MODELS[providerType];
        baseUrl = String((integ.config as Record<string, unknown>)?.base_url ?? '');
      }
    }

    if (!providerType) {
      const { data: integrations } = await admin
        .from('integrations')
        .select('type, config')
        .eq('campaign_id', campaignId)
        .eq('is_enabled', true);
      const first = integrations?.find((i) =>
        LLM_TYPES.includes(i.type as IntegrationType),
      );
      if (first) {
        providerType = first.type as IntegrationType;
        apiKey = String((first.config as Record<string, unknown>)?.api_key ?? '');
        model = DEFAULT_MODELS[providerType];
        baseUrl = String((first.config as Record<string, unknown>)?.base_url ?? '');
      }
    }

    if (!providerType || !apiKey) {
      // Não há LLM configurado — devolve null sem erro pra não quebrar UX.
      return json({ analysis: null, reason: 'sem integração de IA ativa' });
    }

    // Carrega nome do candidato pra contextualizar o prompt
    const { data: camp } = await admin
      .from('campaigns')
      .select('candidate_name')
      .eq('id', campaignId)
      .single();
    const candidate = camp?.candidate_name ?? 'o candidato';

    const prompt = buildPrompt(interview, candidate);

    let raw = '';
    if (providerType === 'anthropic') {
      raw = await callAnthropic(prompt, apiKey, model);
    } else if (providerType === 'gemini') {
      raw = await callGemini(prompt, apiKey, model);
    } else {
      const base = baseUrl || defaultBaseUrl(providerType);
      raw = await callOpenAiCompatible(prompt, apiKey, model, base);
    }

    const analysis = safeParseJson(raw);
    if (!analysis) {
      return json({ analysis: null, reason: 'resposta da IA não parseável' });
    }
    return json({ analysis });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'erro desconhecido' },
      500,
    );
  }
});

function defaultBaseUrl(type: IntegrationType): string {
  switch (type) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'mistral':
      return 'https://api.mistral.ai/v1';
    case 'groq':
      return 'https://api.groq.com/openai/v1';
    case 'xai':
      return 'https://api.x.ai/v1';
    case 'deepseek':
      return 'https://api.deepseek.com';
    default:
      return 'https://api.openai.com/v1';
  }
}
