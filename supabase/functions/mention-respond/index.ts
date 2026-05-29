// Supabase Edge Function — mention-respond
//
// Server-side wrapper para o Módulo de Resposta Rápida.
// Modos:
//   - 'analyze'  → AnaliseMencao  (usa feature mention_insights)
//   - 'generate' → RespostaGerada[] (usa feature reply_suggestions)
//
// Resolução de provedor:
//   1. Lê ai_feature_config da campanha pra feature solicitada
//   2. Se não tiver, usa primeira integração de IA ativa da campanha
//   3. Modelo: o do ai_feature_config.model OU o default da integration.config.model
//
// Deploy: supabase functions deploy mention-respond

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Mode = 'analyze' | 'generate';
type IntegrationType =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'groq'
  | 'xai'
  | 'deepseek';

interface RequestBody {
  mode: Mode;
  mention: {
    content: string;
    source: string;
    author?: string | null;
    published_at?: string;
    sentiment_score?: number;
  };
  candidate: {
    candidate_name: string;
    party: string;
    party_number: string;
    office: string;
    state: string;
  };
  // Modo generate precisa de:
  analise?: unknown;
  contexto?: unknown;
}

interface SelectedProvider {
  type: IntegrationType;
  api_key: string;
  model: string | null;
  organization?: string;
}

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

const DEFAULT_MODELS: Record<IntegrationType, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
  mistral: 'mistral-small-latest',
  groq: 'llama-3.1-8b-instant',
  xai: 'grok-2-mini',
  deepseek: 'deepseek-chat',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !ANON_KEY) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!body.mode || !body.mention || !body.candidate) {
    return json({ error: 'Campos obrigatórios: mode, mention, candidate' }, 400);
  }

  // Client com JWT do caller (RLS filtra por current_campaign_id)
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await caller.auth.getUser();
  if (userErr || !user) return json({ error: 'Sessão inválida' }, 401);

  let provider: SelectedProvider;
  try {
    provider = await selectProvider(caller, body.mode);
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }

  try {
    if (body.mode === 'analyze') {
      const result = await runAnalyze(provider, body);
      return json({ ok: true, provider: provider.type, model: provider.model, result });
    }
    const result = await runGenerate(provider, body);
    return json({ ok: true, provider: provider.type, model: provider.model, result });
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

async function selectProvider(client: SupabaseClient, mode: Mode): Promise<SelectedProvider> {
  // 1) Tenta ai_feature_config (RLS já filtra por current_campaign_id)
  const feature = mode === 'analyze' ? 'mention_insights' : 'reply_suggestions';
  const { data: cfg } = await client
    .from('ai_feature_config')
    .select('integration_id, model')
    .eq('feature', feature)
    .maybeSingle();

  let integrationId: string | null = (cfg?.integration_id as string | null) ?? null;
  let model: string | null = (cfg?.model as string | null) ?? null;

  // 2) Sem configuração explícita → primeira integração de IA ativa
  if (!integrationId) {
    const { data: anyLlm } = await client
      .from('integrations')
      .select('id, type, secrets, config')
      .in('type', LLM_TYPES)
      .eq('is_enabled', true)
      .limit(1)
      .maybeSingle();
    if (anyLlm) {
      const lt = anyLlm.type as IntegrationType;
      const key = (anyLlm.secrets as Record<string, string>)?.api_key;
      const orgConfig = (anyLlm.config as Record<string, string>) ?? {};
      if (!key) {
        throw new Error(`Integração ${lt} habilitada mas sem api_key. Volte em /integracoes.`);
      }
      return {
        type: lt,
        api_key: key,
        model: model?.trim() || (orgConfig.model as string)?.trim() || DEFAULT_MODELS[lt],
        organization: orgConfig.organization,
      };
    }
    throw new Error(
      'Nenhuma integração de IA habilitada. Configure ao menos uma em /integracoes.',
    );
  }

  // 3) Tem ai_feature_config → busca a integração
  const { data: integ, error: iErr } = await client
    .from('integrations')
    .select('type, secrets, config, is_enabled')
    .eq('id', integrationId)
    .maybeSingle();
  if (iErr || !integ) throw new Error('Integração selecionada para esta feature não foi encontrada.');
  if (!integ.is_enabled) throw new Error('Integração selecionada está desabilitada.');
  const lt = integ.type as IntegrationType;
  const key = (integ.secrets as Record<string, string>)?.api_key;
  const orgConfig = (integ.config as Record<string, string>) ?? {};
  if (!key) throw new Error(`Falta api_key na integração ${lt}.`);
  return {
    type: lt,
    api_key: key,
    model: model?.trim() || (orgConfig.model as string)?.trim() || DEFAULT_MODELS[lt],
    organization: orgConfig.organization,
  };
}

// ---------------------------------------------------------------------------
// LLM call adapters
// ---------------------------------------------------------------------------

async function callLlm(
  provider: SelectedProvider,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  switch (provider.type) {
    case 'anthropic':
      return callAnthropic(provider, system, user, maxTokens);
    case 'openai':
    case 'mistral':
    case 'groq':
    case 'xai':
    case 'deepseek':
      return callOpenAiCompatible(provider, system, user, maxTokens);
    case 'gemini':
      return callGemini(provider, system, user, maxTokens);
  }
}

async function callAnthropic(p: SelectedProvider, system: string, user: string, maxTokens: number) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': p.api_key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: p.model || DEFAULT_MODELS.anthropic,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text ?? '';
}

function openAiCompatibleEndpoint(t: IntegrationType): string {
  switch (t) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'mistral':
      return 'https://api.mistral.ai/v1/chat/completions';
    case 'groq':
      return 'https://api.groq.com/openai/v1/chat/completions';
    case 'xai':
      return 'https://api.x.ai/v1/chat/completions';
    case 'deepseek':
      return 'https://api.deepseek.com/v1/chat/completions';
    default:
      throw new Error(`Endpoint não definido para ${t}`);
  }
}

async function callOpenAiCompatible(
  p: SelectedProvider,
  system: string,
  user: string,
  maxTokens: number,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${p.api_key}`,
    'Content-Type': 'application/json',
  };
  if (p.organization) headers['OpenAI-Organization'] = p.organization;
  const res = await fetch(openAiCompatibleEndpoint(p.type), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: p.model || DEFAULT_MODELS[p.type],
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format:
        p.type === 'openai' || p.type === 'mistral' || p.type === 'groq'
          ? { type: 'json_object' }
          : undefined,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${p.type} ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(p: SelectedProvider, system: string, user: string, maxTokens: number) {
  const model = p.model || DEFAULT_MODELS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(p.api_key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ---------------------------------------------------------------------------
// JSON parsing — robust to markdown code fences
// ---------------------------------------------------------------------------

function safeParseJson<T>(raw: string): T {
  if (!raw) throw new Error('LLM retornou resposta vazia');
  let s = raw.trim();
  // Remove cercas de código tipo ```json ... ```
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  // Encontra o primeiro `{` ou `[` se ainda tiver lixo
  const firstBrace = s.search(/[\[{]/);
  if (firstBrace > 0) s = s.slice(firstBrace);
  try {
    return JSON.parse(s) as T;
  } catch (err) {
    throw new Error(`Falha ao parsear JSON do LLM: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Mode: analyze
// ---------------------------------------------------------------------------

const SYSTEM_ANALYZE = `Você é especialista em comunicação política brasileira.
Analise ataques políticos identificando:
1. A alegação central
2. Dados ou fatos citados (sinalize se parecem reais, distorcidos ou falsos)
3. O tom emocional
4. A audiência provável
5. Urgência de resposta (1-10)
6. Tipo de ataque (distorção, ataque pessoal, fake news, opinião legítima, dado distorcido, etc.)

Responda APENAS em JSON válido neste formato exato (sem markdown):
{
  "alegacao_central": "string",
  "dados_citados": ["string", "..."],
  "tom": "string",
  "audiencia": "string",
  "urgencia": 1-10,
  "tipo_ataque": "string"
}`;

async function runAnalyze(provider: SelectedProvider, body: RequestBody): Promise<unknown> {
  const user = `Candidato: ${body.candidate.candidate_name} (${body.candidate.party} · ${body.candidate.office} ${body.candidate.state})
Menção (${body.mention.source}${body.mention.author ? ' / ' + body.mention.author : ''}):
"${body.mention.content}"
Sentimento detectado: ${body.mention.sentiment_score ?? 'n/a'}

Analise este ataque seguindo o formato JSON estrito.`;
  const raw = await callLlm(provider, SYSTEM_ANALYZE, user, 800);
  return safeParseJson(raw);
}

// ---------------------------------------------------------------------------
// Mode: generate
// ---------------------------------------------------------------------------

const SYSTEM_GENERATE = `Você é especialista em comunicação política brasileira eleitoral.
Gere respostas políticas eficazes para ataques nas redes sociais.

Regras obrigatórias:
- Linguagem direta, humana, sem juridiquês
- Nunca atacar pessoalmente o autor do ataque
- Sempre ancorar em fato verificável (use o contexto recebido)
- Adequar ao limite de caracteres da plataforma (X: 280, Instagram: 2200, Facebook: 5000)
- Tom firme mas não agressivo
- Finalizar com chamada à ação ou convite ao diálogo

Gere EXATAMENTE 3 opções de resposta com estilos diferentes:
1. DIRETA: factual, seca, corrige o dado sem emoção
2. HUMANIZADA: pessoal, conecta com o eleitor, usa história/experiência
3. PROPOSITIVA: vira o jogo, foca no que o candidato fez/vai fazer

Responda APENAS em JSON válido neste formato exato (sem markdown):
{
  "respostas": [
    {
      "estilo": "DIRETA",
      "titulo": "Factual e precisa",
      "texto": "string (a resposta em si)",
      "caracteres": number,
      "adequada_para": "X | Instagram | Facebook | Todos",
      "risco": "baixo | medio | alto",
      "justificativa": "string"
    },
    { "estilo": "HUMANIZADA", ... },
    { "estilo": "PROPOSITIVA", ... }
  ]
}`;

async function runGenerate(provider: SelectedProvider, body: RequestBody): Promise<unknown> {
  const user = `Candidato: ${body.candidate.candidate_name} (${body.candidate.party} · ${body.candidate.office} ${body.candidate.state})
Plataforma: ${body.mention.source}
Ataque recebido:
"${body.mention.content}"

Análise prévia: ${JSON.stringify(body.analise ?? {}, null, 0)}
Contexto real (fatos verificáveis): ${JSON.stringify(body.contexto ?? {}, null, 0)}

Gere as 3 respostas no formato JSON estrito.`;
  const raw = await callLlm(provider, SYSTEM_GENERATE, user, 1500);
  return safeParseJson(raw);
}
