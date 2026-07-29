// ============================================================================
// Supabase Edge Function — survey-form-analyze
// ----------------------------------------------------------------------------
// Leitura estratégica de UM formulário de pesquisa (aba "Por Pesquisa").
// Recebe um resumo (demografia + respostas + correlações) já computado no
// cliente e devolve uma análise estratégica estruturada, feita pelo agente.
//
// Reaproveita a infra multi-provider do intelligence-analyze:
//   - resolve o provider por ai_feature_config('electoral_intelligence') OU
//     pela prioridade entre as integrações LLM habilitadas da campanha
//   - chave em integrations.secrets.api_key
//
// Auth: exige o JWT do usuário (membro da campanha ou super admin).
// Deploy: supabase functions deploy survey-form-analyze
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type IntegrationType =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'groq'
  | 'xai'
  | 'deepseek';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
const PROVIDER_PRIORITY: IntegrationType[] = [
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
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-pro',
  mistral: 'mistral-large-latest',
  groq: 'llama-3.1-70b-versatile',
  xai: 'grok-2-latest',
  deepseek: 'deepseek-chat',
};

// deno-lint-ignore no-explicit-any
type Admin = any;

async function callAnthropic(prompt: string, key: string, model: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}
async function callOpenAi(prompt: string, key: string, model: string, base: string) {
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
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
async function callGemini(prompt: string, key: string, model: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
function safeParse(text: string): Record<string, unknown> | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
function defaultBase(type: IntegrationType) {
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

function buildPrompt(candidate: string, formName: string, summary: string): string {
  return `Você é um estrategista eleitoral sênior analisando os dados de UMA pesquisa da campanha de ${candidate}.

Pesquisa: "${formName}"

DADOS (demografia, respostas por pergunta e correlações estatísticas já calculadas):
${summary}

Analise com foco ESTRATÉGICO e ACIONÁVEL. Interprete as correlações ("associação forte" = as respostas andam juntas, indício de que uma percepção influencia a outra). Seja concreto, direto e em português do Brasil. Não invente números além dos fornecidos; se a amostra for pequena, diga que é indicativo.

Responda APENAS um JSON válido com este formato exato:
{
  "resumo": "2-3 frases com a leitura estratégica geral desta pesquisa (perfil do eleitor, clima, o essencial)",
  "puxa_voto": ["frases curtas sobre o que mais influencia a intenção/aprovação, a partir das correlações"],
  "riscos": ["riscos ou pontos de atenção revelados pela pesquisa"],
  "oportunidades": ["oportunidades de conversão/crescimento identificadas"],
  "acoes": ["3 a 5 ações concretas e priorizadas que a campanha deveria tomar com base nesta pesquisa"]
}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return json({ error: 'Servidor mal configurado' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  let body: { campaign_id?: string; form_name?: string; summary?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const { campaign_id, form_name, summary } = body;
  if (!campaign_id || !summary) {
    return json({ error: 'campaign_id e summary são obrigatórios' }, 400);
  }

  const admin: Admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Valida o chamador: membro da campanha OU super admin.
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await anon.auth.getUser();
  const caller = userData?.user;
  if (!caller) return json({ error: 'Sessão inválida' }, 401);

  const [{ data: membership }, { data: superAdmin }] = await Promise.all([
    admin
      .from('campaign_users')
      .select('user_id')
      .eq('user_id', caller.id)
      .eq('campaign_id', campaign_id)
      .maybeSingle(),
    admin.from('super_admins').select('user_id').eq('user_id', caller.id).maybeSingle(),
  ]);
  if (!membership && !superAdmin) {
    return json({ error: 'Sem acesso a esta campanha' }, 403);
  }

  // 2) Resolve o provider LLM (mesma lógica do intelligence-analyze).
  const { data: featureCfg } = await admin
    .from('ai_feature_config')
    .select('integration_id, model')
    .eq('campaign_id', campaign_id)
    .eq('feature', 'electoral_intelligence')
    .maybeSingle();

  let providerType: IntegrationType | null = null;
  let apiKey = '';
  let model = '';
  let baseUrl = '';

  if (featureCfg?.integration_id) {
    const { data: integ } = await admin
      .from('integrations')
      .select('type, secrets, config, is_enabled')
      .eq('id', featureCfg.integration_id)
      .single();
    if (integ && integ.is_enabled && LLM_TYPES.includes(integ.type as IntegrationType)) {
      providerType = integ.type as IntegrationType;
      apiKey = String((integ.secrets as Record<string, unknown>)?.api_key ?? '');
      model =
        (featureCfg.model as string | null)?.trim() ||
        ((integ.config as Record<string, unknown>)?.model as string) ||
        DEFAULT_MODELS[providerType];
      baseUrl = String((integ.config as Record<string, unknown>)?.base_url ?? '');
    }
  }
  if (!providerType) {
    const { data: ints } = await admin
      .from('integrations')
      .select('type, secrets, config')
      .eq('campaign_id', campaign_id)
      .eq('is_enabled', true);
    for (const preferred of PROVIDER_PRIORITY) {
      const match = ints?.find((i: { type: string }) => i.type === preferred);
      if (match) {
        providerType = preferred;
        apiKey = String((match.secrets as Record<string, unknown>)?.api_key ?? '');
        model =
          ((match.config as Record<string, unknown>)?.model as string) ||
          DEFAULT_MODELS[preferred];
        baseUrl = String((match.config as Record<string, unknown>)?.base_url ?? '');
        break;
      }
    }
  }

  if (!providerType || !apiKey) {
    return json(
      {
        error:
          'Nenhuma IA configurada para esta campanha. Configure um provider (Anthropic/OpenAI/Gemini) em Integrações.',
      },
      400,
    );
  }

  // 3) Chama a IA.
  const { data: camp } = await admin
    .from('campaigns')
    .select('candidate_name')
    .eq('id', campaign_id)
    .single();
  const candidate = camp?.candidate_name ?? 'o candidato';
  const prompt = buildPrompt(candidate, form_name ?? 'Pesquisa', summary);

  let raw = '';
  try {
    if (providerType === 'anthropic') raw = await callAnthropic(prompt, apiKey, model);
    else if (providerType === 'gemini') raw = await callGemini(prompt, apiKey, model);
    else raw = await callOpenAi(prompt, apiKey, model, baseUrl || defaultBase(providerType));
  } catch (err) {
    return json({ error: `IA falhou: ${err instanceof Error ? err.message : 'erro'}` }, 502);
  }

  const parsed = safeParse(raw);
  if (!parsed) {
    return json({ error: 'A IA respondeu num formato inesperado. Tente de novo.' }, 502);
  }

  return json({ ok: true, analysis: parsed, provider: providerType });
});
