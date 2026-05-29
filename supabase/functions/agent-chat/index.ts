// Supabase Edge Function — agent-chat
//
// Backbone dos agentes de IA do Vórtice:
//   - agent 'steve'  → estrategista; injeta CONTEXTO REAL da campanha
//   - agent 'carlos' → assistente operacional; injeta tela atual + usuário
//
// Toda a chamada ao LLM é server-side (as keys vivem em integrations.secrets).
// Provedor: ai_agents.llm_provider da campanha (anthropic/openai) ou, se null,
// a primeira integração de IA habilitada (fallback). Reaproveita o padrão do
// mention-respond.
//
// Deploy: supabase functions deploy agent-chat

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Agent = 'steve' | 'carlos';
type IntegrationType = 'anthropic' | 'openai' | 'gemini' | 'mistral' | 'groq' | 'xai' | 'deepseek';
type Role = 'user' | 'assistant';

interface ChatMessage {
  role: Role;
  content: string;
}

interface RequestBody {
  agent: Agent;
  campaign_id: string;
  messages: ChatMessage[];
  page?: string; // só Carlos (rota atual)
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

const LLM_TYPES: IntegrationType[] = ['anthropic', 'openai', 'gemini', 'mistral', 'groq', 'xai', 'deepseek'];
const DEFAULT_MODELS: Record<IntegrationType, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
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
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) return json({ error: 'Server misconfigured' }, 500);

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!body.agent || !body.campaign_id || !Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: 'Campos obrigatórios: agent, campaign_id, messages[]' }, 400);
  }
  if (body.agent !== 'steve' && body.agent !== 'carlos') {
    return json({ error: 'agent inválido' }, 400);
  }

  // Caller client (JWT) — só para autenticar/autorizar.
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await caller.auth.getUser();
  if (userErr || !user) return json({ error: 'Sessão inválida' }, 401);

  // Autorização da campanha (membro ativo) ou super admin.
  const { data: membership } = await caller
    .from('campaign_users')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('campaign_id', body.campaign_id)
    .maybeSingle();
  const isMember = membership?.is_active === true;
  const memberRole = membership?.role as string | undefined;
  let isSuper = false;
  if (!isMember) {
    const { data: s } = await caller.rpc('is_super_admin');
    isSuper = s === true;
  }
  if (!isMember && !isSuper) return json({ error: 'Sem acesso a esta campanha' }, 403);

  // Steve é restrito a admin/candidato (ou super admin).
  if (body.agent === 'steve' && !isSuper && !(isMember && (memberRole === 'admin' || memberRole === 'candidate'))) {
    return json({ error: 'Steve_AI é restrito a admin e candidato.' }, 403);
  }

  // Service role para ler dados/segredos da campanha alvo (já autorizada).
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let provider: SelectedProvider;
  try {
    provider = await selectAgentProvider(admin, body.campaign_id, body.agent);
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }

  try {
    const { system, temperature, maxTokens } =
      body.agent === 'steve'
        ? {
            system: await buildSteveSystem(admin, body.campaign_id),
            temperature: 0,
            maxTokens: 1500,
          }
        : {
            system: buildCarlosSystem(user, memberRole, body.page),
            temperature: 0.3,
            maxTokens: 800,
          };

    const reply = await callChat(provider, system, body.messages, maxTokens, temperature);
    return json({ ok: true, provider: provider.type, model: provider.model, reply });
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Provider selection (por agente)
// ---------------------------------------------------------------------------

async function selectAgentProvider(
  admin: SupabaseClient,
  campaignId: string,
  agent: Agent,
): Promise<SelectedProvider> {
  // Preferência configurada do agente.
  const { data: agentRow } = await admin
    .from('ai_agents')
    .select('llm_provider')
    .eq('campaign_id', campaignId)
    .eq('agent_key', agent)
    .maybeSingle();
  const preferred = (agentRow?.llm_provider as IntegrationType | null) ?? null;

  // Integrações de IA habilitadas da campanha.
  const { data: integ } = await admin
    .from('integrations')
    .select('type, secrets, config, is_enabled')
    .eq('campaign_id', campaignId)
    .in('type', LLM_TYPES)
    .eq('is_enabled', true);

  const enabled = (integ ?? []) as Array<{
    type: IntegrationType;
    secrets: Record<string, string> | null;
    config: Record<string, string> | null;
  }>;
  if (enabled.length === 0) {
    throw new Error('Nenhuma integração de IA habilitada. Configure uma em Integrações.');
  }

  // Ordem de escolha: preferida (se tiver key) → anthropic → openai → qualquer.
  const pick =
    (preferred && enabled.find((e) => e.type === preferred && e.secrets?.api_key)) ||
    enabled.find((e) => e.type === 'anthropic' && e.secrets?.api_key) ||
    enabled.find((e) => e.type === 'openai' && e.secrets?.api_key) ||
    enabled.find((e) => e.secrets?.api_key);

  if (!pick) throw new Error('Integração de IA habilitada mas sem api_key. Volte em Integrações.');

  return {
    type: pick.type,
    api_key: pick.secrets!.api_key,
    model: (pick.config?.model as string) ?? DEFAULT_MODELS[pick.type],
    organization: pick.config?.organization,
  };
}

// ---------------------------------------------------------------------------
// Steve — contexto real da campanha
// ---------------------------------------------------------------------------

const GOV_SCORE: Record<string, number> = { otimo: 5, bom: 4, regular: 3, ruim: 2, pessimo: 1 };

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

async function buildSteveSystem(admin: SupabaseClient, campaignId: string): Promise<string> {
  const [campaign, context] = await Promise.all([
    admin.from('campaigns').select('candidate_name, party, office, state').eq('id', campaignId).maybeSingle(),
    buildCampaignContext(admin, campaignId),
  ]);
  const c = (campaign.data ?? {}) as { candidate_name?: string; party?: string };
  return STEVE_SYSTEM_PROMPT
    .replace('{candidate_name}', c.candidate_name ?? 'o candidato')
    .replace('{party}', c.party ?? '')
    .replace('{campaign_data}', context);
}

async function buildCampaignContext(admin: SupabaseClient, campaignId: string): Promise<string> {
  const safe = async <T>(p: Promise<{ data: T | null }>): Promise<T | null> => {
    try {
      return (await p).data;
    } catch {
      return null;
    }
  };

  const [voters, supporters, interviews, mentions, events, intelligence] = await Promise.all([
    safe<Array<{ vote_intention: string; city: string | null }>>(
      admin.from('voters').select('vote_intention, city').eq('campaign_id', campaignId).limit(5000) as never,
    ),
    safe<Array<{ status: string }>>(
      admin.from('supporters').select('status').eq('campaign_id', campaignId).eq('status', 'ativo') as never,
    ),
    safe<Array<{ priority_themes: string[] | null; receptivity_score: number | null; state_gov_rating: string | null; federal_gov_rating: string | null; city_gov_rating: string | null }>>(
      admin
        .from('field_interviews')
        .select('priority_themes, receptivity_score, state_gov_rating, federal_gov_rating, city_gov_rating')
        .eq('campaign_id', campaignId)
        .limit(2000) as never,
    ),
    safe<Array<{ sentiment: string }>>(
      admin
        .from('mentions')
        .select('sentiment')
        .eq('campaign_id', campaignId)
        .order('published_at', { ascending: false })
        .limit(20) as never,
    ),
    safe<Array<{ title: string; city: string | null; date: string }>>(
      admin
        .from('events')
        .select('title, city, date')
        .eq('campaign_id', campaignId)
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(5) as never,
    ),
    safe<Array<{ campaign_health_score: number | null; resumo_executivo: string | null; risk_alerts: unknown[] | null; opportunities: unknown[] | null }>>(
      admin
        .from('campaign_intelligence')
        .select('campaign_health_score, resumo_executivo, risk_alerts, opportunities')
        .eq('campaign_id', campaignId)
        .order('generated_at', { ascending: false })
        .limit(1) as never,
    ),
  ]);

  const v = voters ?? [];
  const dist: Record<string, number> = { apoiador: 0, tendencia_apoio: 0, indeciso: 0, tendencia_oposicao: 0, oposicao: 0 };
  for (const row of v) if (row.vote_intention in dist) dist[row.vote_intention]++;

  // Força por cidade (deriva — não há tabela municipality_strength).
  const byCity = new Map<string, { fav: number; total: number }>();
  for (const row of v) {
    const city = (row.city ?? '').trim();
    if (!city) continue;
    const e = byCity.get(city) ?? { fav: 0, total: 0 };
    e.total++;
    if (row.vote_intention === 'apoiador' || row.vote_intention === 'tendencia_apoio') e.fav++;
    byCity.set(city, e);
  }
  const cityStats = [...byCity.entries()]
    .filter(([, s]) => s.total >= 5)
    .map(([name, s]) => ({ name, pct: Math.round((s.fav / s.total) * 100), total: s.total }));
  const strong = cityStats.filter((s) => s.pct >= 70).map((s) => `${s.name} (${s.pct}%)`);
  const weak = cityStats.filter((s) => s.pct <= 30).map((s) => `${s.name} (${s.pct}%)`);

  const iv = interviews ?? [];
  const themeCount = new Map<string, number>();
  for (const it of iv) for (const t of it.priority_themes ?? []) themeCount.set(t, (themeCount.get(t) ?? 0) + 1);
  const topThemes = [...themeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
  const recVals = iv.map((i) => i.receptivity_score).filter((n): n is number => typeof n === 'number');
  const avgRec = recVals.length ? (recVals.reduce((a, b) => a + b, 0) / recVals.length).toFixed(1) : 'n/d';
  const govAvg = (key: 'state_gov_rating' | 'federal_gov_rating' | 'city_gov_rating') => {
    const nums = iv.map((i) => GOV_SCORE[(i[key] ?? '') as string]).filter((n): n is number => typeof n === 'number');
    return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : 'n/d';
  };

  const m = mentions ?? [];
  const sent = {
    pos: m.filter((x) => x.sentiment === 'positivo').length,
    neu: m.filter((x) => x.sentiment === 'neutro').length,
    neg: m.filter((x) => x.sentiment === 'negativo').length,
  };

  const ev = events ?? [];
  const intel = (intelligence ?? [])[0];

  return `DADOS DA CAMPANHA (atualizado agora):

ELEITORES MAPEADOS: ${v.length}
  Apoiadores: ${pct(dist.apoiador, v.length)}%
  Tendência a apoiar: ${pct(dist.tendencia_apoio, v.length)}%
  Indecisos: ${pct(dist.indeciso, v.length)}%
  Tendência à oposição: ${pct(dist.tendencia_oposicao, v.length)}%
  Oposição: ${pct(dist.oposicao, v.length)}%

LIDERANÇAS ATIVAS: ${(supporters ?? []).length}

ENTREVISTAS DE CAMPO: ${iv.length}
  Temas mais citados: ${topThemes.join(', ') || 'sem dados'}
  Receptividade média: ${avgRec}/5
  Avaliação governo estadual: ${govAvg('state_gov_rating')}/5
  Avaliação governo federal: ${govAvg('federal_gov_rating')}/5
  Avaliação prefeitura: ${govAvg('city_gov_rating')}/5

MUNICÍPIOS (força derivada dos eleitores, mín. 5 registros):
  Forte (>=70%): ${strong.join(', ') || 'nenhum'}
  Crítico (<=30%): ${weak.join(', ') || 'nenhum'}

MENÇÕES RECENTES (últimas ${m.length}):
  Positivas: ${sent.pos} · Neutras: ${sent.neu} · Negativas: ${sent.neg}

PRÓXIMOS EVENTOS: ${ev.map((e) => `${e.title}${e.city ? ' em ' + e.city : ''} (${e.date?.slice(0, 10)})`).join(', ') || 'nenhum agendado'}

SCORE DE SAÚDE DA CAMPANHA: ${intel?.campaign_health_score ?? 'não calculado'}/100
RISCOS MAPEADOS: ${(intel?.risk_alerts ?? []).length} · OPORTUNIDADES: ${(intel?.opportunities ?? []).length}
${intel?.resumo_executivo ? `RESUMO EXECUTIVO IA: ${intel.resumo_executivo}` : ''}`;
}

const STEVE_SYSTEM_PROMPT = `Você é Steve_AI, estrategista político sênior com 30 anos de experiência em campanhas eleitorais brasileiras e internacionais.

Seu perfil mescla:
- Duda Mendonça: conexão emocional com o eleitor
- James Carville: análise fria de dados e War Room
- Marcos Coimbra: rigor de pesquisa eleitoral

Regras absolutas:
1. NUNCA opine sem embasar em dados da campanha
2. Seja direto — sem enrolação, sem eufemismo
3. Fale em linguagem política brasileira
4. Sempre aponte o problema E a solução
5. Quando os dados forem insuficientes, diga claramente
6. Análise, não criatividade

Dados atuais da campanha {candidate_name} ({party}):
{campaign_data}

Ao responder:
- Cite os números reais
- Compare com benchmarks quando possível
- Dê prioridade (o que fazer PRIMEIRO)
- Seja acionável (o que fazer, onde, quando, com quem)`;

// ---------------------------------------------------------------------------
// Carlos — assistente operacional do sistema
// ---------------------------------------------------------------------------

const PAGE_DESCRIPTIONS: Record<string, string> = {
  '/dashboard': 'Dashboard principal',
  '/eleitores': 'lista de Eleitores',
  '/liderancas': 'lista de Lideranças',
  '/mapa': 'Mapa Eleitoral',
  '/mencoes': 'Monitor de Menções',
  '/campo': 'Módulo de Pesquisas/Entrevistas',
  '/inteligencia': 'Inteligência Eleitoral',
  '/agenda': 'Agenda de eventos',
  '/usuarios': 'Gestão de Usuários',
  '/integracoes': 'Configurações de Integrações',
  '/branding': 'Identidade Visual',
  '/agentes/steve': 'chat com Steve_AI',
};

function buildCarlosSystem(
  user: { email?: string; user_metadata?: Record<string, unknown> },
  role: string | undefined,
  page?: string,
): string {
  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'usuário';
  const pageDesc = (page && PAGE_DESCRIPTIONS[page]) || 'página do Vórtice';
  return CARLOS_SYSTEM_PROMPT
    .replace('{user_name}', name)
    .replace('{user_role}', role ?? 'usuário')
    .replace('{current_page}', pageDesc);
}

const CARLOS_SYSTEM_PROMPT = `Você é Carlos_AI_Op, assistente especializado no sistema Vórtice — plataforma de gestão de campanhas políticas.

Seu papel: ensinar usuários a usar o sistema de forma simples, clara e passo a passo.

Regras:
1. Sempre use linguagem simples — sem jargão técnico
2. Use passos numerados quando for um processo
3. Seja breve — máximo 5 passos por resposta
4. Se não souber: "Não tenho essa informação. Entre em contato com o suporte."
5. Seja didático e acolhedor

CONHECIMENTO DO SISTEMA VÓRTICE:

MÓDULOS:
- Dashboard: visão geral da campanha
- Inteligência Eleitoral: análise de dados com IA (planos intermediário/avançado)
- Lideranças: cadastro de correligionários
- Eleitores: cadastro e importação de eleitores
- Mapa Eleitoral: visualização geográfica (MG)
- Menções: monitor de redes sociais + Resposta Rápida
- Pesquisas/Entrevistas: questionários de campo
- Agenda: eventos e compromissos
- Usuários: gestão da equipe
- Integrações: conectar APIs (IA, coleta, mídia, mensageria) e Agentes de IA
- Identidade: logo e cores da campanha
- Steve_AI: estrategista político (admin/candidato)

FLUXOS PRINCIPAIS:
- Importar eleitores: Eleitores → "Importar CSV" → baixe o "Modelo", preencha, envie o arquivo, confira o preview (válidas/erros/duplicadas) e confirme.
- Geocodificar endereços: Eleitores → "Geocodificar pendentes" (admin) → adiciona coordenadas pelos endereços.
- Criar usuário da equipe: Usuários → "Provisionar membro" → nome, e-mail (único), papel → "Criar conta" → copie a senha temporária e envie à pessoa (ela troca no 1º acesso).
- Configurar uma integração (ex.: Asaas ou IA): Integrações → aba "Conexões" → escolha a integração → informe a chave → salve e teste.
- Configurar os Agentes de IA: Integrações → aba "Agentes de IA" → ajuste nome, foto e o LLM preferido de cada agente.
- Usar o Mapa: Mapa Eleitoral → visualize força por município de MG.
- Agendar evento: Agenda → novo evento (título, data, cidade, tipo).

Usuário atual: {user_name} · Papel: {user_role}
Tela atual: {current_page}`;

// ---------------------------------------------------------------------------
// LLM call (multi-turn)
// ---------------------------------------------------------------------------

async function callChat(
  p: SelectedProvider,
  system: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number,
): Promise<string> {
  if (p.type === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': p.api_key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: p.model ?? DEFAULT_MODELS.anthropic,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? '';
  }

  if (p.type === 'gemini') {
    const model = p.model ?? DEFAULT_MODELS.gemini;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(p.api_key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  // openai-compatível (openai, mistral, groq, xai, deepseek)
  const endpoints: Record<string, string> = {
    openai: 'https://api.openai.com/v1/chat/completions',
    mistral: 'https://api.mistral.ai/v1/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    xai: 'https://api.x.ai/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
  };
  const headers: Record<string, string> = { Authorization: `Bearer ${p.api_key}`, 'Content-Type': 'application/json' };
  if (p.organization) headers['OpenAI-Organization'] = p.organization;
  const res = await fetch(endpoints[p.type], {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: p.model ?? DEFAULT_MODELS[p.type],
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (!res.ok) throw new Error(`${p.type} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}
