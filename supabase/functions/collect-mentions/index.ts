// Supabase Edge Function — collect-mentions
//
// Coleta menções públicas das integrações habilitadas na campanha do caller:
//   - twitter (X API v2 — recent search)
//   - google_news (RSS público)
//
// Para cada menção nova (dedup por URL):
//   1. Classifica sentimento via LLM (feature mention_sentiment do
//      ai_feature_config, fallback pra primeira integração de IA ativa)
//   2. Insere em public.mentions via service role
//
// Retorna { ok, sources: { twitter: { fetched, inserted, skipped }, ... } }
//
// Pode ser invocada:
//   - Manualmente via botão "Coletar agora" no /mencoes
//   - Periodicamente via pg_cron + extensão http (ver README)
//
// Deploy: supabase functions deploy collect-mentions

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type IntegrationType =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'groq'
  | 'xai'
  | 'deepseek';

interface CandidateRef {
  candidate_name: string;
  party: string;
  state: string;
}

interface CollectionStats {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

interface MentionDraft {
  source: 'twitter' | 'google_news';
  content: string;
  url: string;
  author: string | null;
  published_at: string;
}

interface SentimentResult {
  sentiment: 'positivo' | 'neutro' | 'negativo';
  score: number; // -1..+1
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
  mistral: 'mistral-small-latest',
  groq: 'llama-3.1-8b-instant',
  xai: 'grok-2-mini',
  deepseek: 'deepseek-chat',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  // Client com JWT do caller (RLS filtra a campanha)
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await caller.auth.getUser();
  if (userErr || !user) return json({ error: 'Sessão inválida' }, 401);

  // Resolve campaign do caller via campaign_users + campaigns
  const { data: membership, error: memErr } = await caller
    .from('campaign_users')
    .select('campaign_id, role, is_active, campaign:campaigns(candidate_name, party, state)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (memErr || !membership) {
    return json({ error: 'Usuário sem campanha ativa' }, 403);
  }
  const campaignId = membership.campaign_id as string;
  const candidate = membership.campaign as unknown as CandidateRef | null;
  if (!candidate) return json({ error: 'Campanha não encontrada' }, 404);

  // Lista integrações de coleta habilitadas (twitter, google_news)
  const { data: integrations } = await caller
    .from('integrations')
    .select('type, secrets, config')
    .in('type', ['twitter', 'google_news'])
    .eq('is_enabled', true);

  if (!integrations || integrations.length === 0) {
    return json({
      ok: false,
      error:
        'Nenhuma integração de coleta habilitada. Configure X (Twitter) ou Google News em /integracoes.',
    });
  }

  // Service role para inserts cross-RLS
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Cache de URLs já existentes na campanha para dedup
  const { data: existing } = await admin
    .from('mentions')
    .select('url')
    .eq('campaign_id', campaignId)
    .not('url', 'is', null);
  const existingUrls = new Set(
    (existing ?? []).map((r) => r.url as string).filter(Boolean),
  );

  // Resolve provedor LLM para classificação de sentimento
  let llmProvider: ResolvedProvider | null = null;
  try {
    llmProvider = await selectSentimentProvider(caller);
  } catch (err) {
    // Sem IA configurada — coletamos mesmo assim, sentimento marcado como 'neutro'
    console.warn('[collect-mentions] LLM indisponível:', (err as Error).message);
  }

  const stats: Record<string, CollectionStats> = {};

  for (const integ of integrations) {
    const type = integ.type as 'twitter' | 'google_news';
    const secrets = (integ.secrets as Record<string, string>) ?? {};
    const config = (integ.config as Record<string, string>) ?? {};
    stats[type] = { fetched: 0, inserted: 0, skipped: 0, errors: [] };

    try {
      const drafts =
        type === 'twitter'
          ? await fetchTwitter(secrets, config, candidate)
          : await fetchGoogleNews(config, candidate);
      stats[type].fetched = drafts.length;

      for (const draft of drafts) {
        if (existingUrls.has(draft.url)) {
          stats[type].skipped += 1;
          continue;
        }
        let sentiment: SentimentResult = { sentiment: 'neutro', score: 0 };
        if (llmProvider) {
          try {
            sentiment = await classifySentiment(llmProvider, draft.content, candidate);
          } catch (err) {
            stats[type].errors.push(`classify: ${(err as Error).message}`);
          }
        }
        const { error: insErr } = await admin.from('mentions').insert({
          campaign_id: campaignId,
          source: draft.source,
          content: draft.content,
          url: draft.url,
          author: draft.author,
          sentiment: sentiment.sentiment,
          sentiment_score: sentiment.score,
          published_at: draft.published_at,
        });
        if (insErr) {
          stats[type].errors.push(`insert: ${insErr.message}`);
        } else {
          stats[type].inserted += 1;
          existingUrls.add(draft.url);
        }
      }
    } catch (err) {
      stats[type].errors.push((err as Error).message);
    }
  }

  return json({ ok: true, sources: stats, provider: llmProvider?.type ?? null });
});

// ---------------------------------------------------------------------------
// Twitter (X) API v2 — recent search
// ---------------------------------------------------------------------------

async function fetchTwitter(
  secrets: Record<string, string>,
  config: Record<string, string>,
  candidate: CandidateRef,
): Promise<MentionDraft[]> {
  const bearer = secrets.bearer_token;
  if (!bearer) throw new Error('Falta bearer_token no X (Twitter)');
  const query =
    (config.search_query as string) ||
    `"${candidate.candidate_name}" lang:pt -is:retweet`;
  const url =
    `https://api.twitter.com/2/tweets/search/recent` +
    `?query=${encodeURIComponent(query)}` +
    `&max_results=20` +
    `&tweet.fields=created_at,author_id` +
    `&expansions=author_id` +
    `&user.fields=username,name`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ id: string; text: string; created_at: string; author_id: string }>;
    includes?: { users?: Array<{ id: string; username: string; name: string }> };
  };
  const users = new Map<string, { username: string; name: string }>();
  for (const u of data.includes?.users ?? []) {
    users.set(u.id, { username: u.username, name: u.name });
  }
  return (data.data ?? []).map((t) => {
    const u = users.get(t.author_id);
    return {
      source: 'twitter' as const,
      content: t.text,
      url: `https://twitter.com/${u?.username ?? 'i/web'}/status/${t.id}`,
      author: u ? `@${u.username}` : null,
      published_at: t.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Google News RSS — busca pública
// ---------------------------------------------------------------------------

async function fetchGoogleNews(
  config: Record<string, string>,
  candidate: CandidateRef,
): Promise<MentionDraft[]> {
  const query = (config.query as string) || `"${candidate.candidate_name}"`;
  const language = (config.language as string) || 'pt-BR';
  const url =
    `https://news.google.com/rss/search` +
    `?q=${encodeURIComponent(query)}` +
    `&hl=${encodeURIComponent(language)}` +
    `&gl=BR&ceid=BR:pt-419`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google News ${res.status}`);
  }
  const xml = await res.text();
  return parseRssItems(xml).slice(0, 20);
}

function parseRssItems(xml: string): MentionDraft[] {
  const drafts: MentionDraft[] = [];
  // Captura cada bloco <item>...</item>
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const source = extractTag(block, 'source');
    if (!title || !link) continue;
    const published_at = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
    drafts.push({
      source: 'google_news',
      content: stripHtml(title),
      url: link.trim(),
      author: source ? stripHtml(source) : null,
      published_at,
    });
  }
  return drafts;
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  if (!m) return null;
  return m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// LLM provider para classificação de sentimento
// ---------------------------------------------------------------------------

interface ResolvedProvider {
  type: IntegrationType;
  api_key: string;
  model: string;
  organization?: string;
}

async function selectSentimentProvider(client: SupabaseClient): Promise<ResolvedProvider> {
  // 1) ai_feature_config para mention_sentiment
  const { data: cfg } = await client
    .from('ai_feature_config')
    .select('integration_id, model')
    .eq('feature', 'mention_sentiment')
    .maybeSingle();

  let model: string | null = (cfg?.model as string | null) ?? null;
  let integId: string | null = (cfg?.integration_id as string | null) ?? null;

  if (!integId) {
    const { data: anyLlm } = await client
      .from('integrations')
      .select('id, type, secrets, config')
      .in('type', LLM_TYPES)
      .eq('is_enabled', true)
      .limit(1)
      .maybeSingle();
    if (!anyLlm) {
      throw new Error('Nenhuma integração de IA habilitada para classificar sentimento');
    }
    const lt = anyLlm.type as IntegrationType;
    const key = (anyLlm.secrets as Record<string, string>)?.api_key;
    const cfgObj = (anyLlm.config as Record<string, string>) ?? {};
    if (!key) throw new Error(`Falta api_key na integração ${lt}`);
    return {
      type: lt,
      api_key: key,
      model: model ?? cfgObj.model ?? DEFAULT_MODELS[lt],
      organization: cfgObj.organization,
    };
  }

  const { data: integ } = await client
    .from('integrations')
    .select('type, secrets, config, is_enabled')
    .eq('id', integId)
    .maybeSingle();
  if (!integ || !integ.is_enabled) {
    throw new Error('Integração de mention_sentiment não disponível');
  }
  const lt = integ.type as IntegrationType;
  const key = (integ.secrets as Record<string, string>)?.api_key;
  const cfgObj = (integ.config as Record<string, string>) ?? {};
  if (!key) throw new Error(`Falta api_key na integração ${lt}`);
  return {
    type: lt,
    api_key: key,
    model: model ?? cfgObj.model ?? DEFAULT_MODELS[lt],
    organization: cfgObj.organization,
  };
}

const SYSTEM_SENTIMENT = `Você é um classificador de sentimento para menções políticas em português brasileiro.
Para cada texto sobre um candidato, retorne APENAS um JSON válido (sem markdown):
{ "sentiment": "positivo" | "neutro" | "negativo", "score": número entre -1 e +1 }
Onde -1 é extremamente negativo, 0 é neutro, +1 é extremamente positivo.`;

async function classifySentiment(
  p: ResolvedProvider,
  text: string,
  candidate: CandidateRef,
): Promise<SentimentResult> {
  const user = `Candidato: ${candidate.candidate_name} (${candidate.party} · ${candidate.state})
Texto: "${text}"

Classifique e retorne só o JSON.`;
  const raw = await callLlm(p, SYSTEM_SENTIMENT, user, 80);
  const parsed = safeParseJson<{ sentiment: string; score: number }>(raw);
  const s = parsed.sentiment?.toLowerCase();
  const sentiment: SentimentResult['sentiment'] =
    s === 'positivo' || s === 'positive'
      ? 'positivo'
      : s === 'negativo' || s === 'negative'
        ? 'negativo'
        : 'neutro';
  const score = Math.max(-1, Math.min(1, Number(parsed.score) || 0));
  return { sentiment, score };
}

async function callLlm(p: ResolvedProvider, system: string, user: string, maxTokens: number) {
  switch (p.type) {
    case 'anthropic':
      return callAnthropic(p, system, user, maxTokens);
    case 'openai':
    case 'mistral':
    case 'groq':
    case 'xai':
    case 'deepseek':
      return callOpenAiCompatible(p, system, user, maxTokens);
    case 'gemini':
      return callGemini(p, system, user, maxTokens);
  }
}

async function callAnthropic(p: ResolvedProvider, system: string, user: string, maxTokens: number) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': p.api_key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text ?? '';
}

function openAiEndpoint(t: IntegrationType): string {
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
      throw new Error(`Sem endpoint para ${t}`);
  }
}

async function callOpenAiCompatible(
  p: ResolvedProvider,
  system: string,
  user: string,
  maxTokens: number,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${p.api_key}`,
    'Content-Type': 'application/json',
  };
  if (p.organization) headers['OpenAI-Organization'] = p.organization;
  const res = await fetch(openAiEndpoint(p.type), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: p.model,
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
  if (!res.ok) throw new Error(`${p.type} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(p: ResolvedProvider, system: string, user: string, maxTokens: number) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    p.model,
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
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function safeParseJson<T>(raw: string): T {
  if (!raw) throw new Error('LLM retornou vazio');
  let s = raw.trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const first = s.search(/[\[{]/);
  if (first > 0) s = s.slice(first);
  return JSON.parse(s) as T;
}
