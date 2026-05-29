// Supabase Edge Function — intelligence-analyze
//
// Roda análise estatística + IA sobre as entrevistas de uma campanha.
// Salva o resultado em campaign_intelligence e devolve o id.
//
// Deploy: supabase functions deploy intelligence-analyze
//
// Estratégia:
// 1. Lê todas as field_interviews completas da campanha
// 2. Calcula stats em memória (não envia tudo pra IA — usa o resumo)
// 3. Chama LLM configurado da campanha (igual ao mention-respond /
//    interview-analyze) — provider resolvido por ai_feature_config
//    com feature='campaign_intelligence', ou primeira integração ativa
// 4. Persiste tudo em campaign_intelligence

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

// Ordem de preferência pra ESTA tarefa (Inteligência Eleitoral):
// 1. Anthropic — melhor em PT-BR analítico + schema JSON complexo + nuance política
// 2. OpenAI    — JSON mode confiável, segunda melhor opção
// 3. Gemini    — contexto grande mas perde precisão em schema aninhado
// 4. demais    — fallbacks
// Se a campanha tiver ai_feature_config.feature='campaign_intelligence'
// explícito, ele sobrescreve essa ordem.
const PROVIDER_PRIORITY: IntegrationType[] = [
  'anthropic',
  'openai',
  'gemini',
  'mistral',
  'groq',
  'xai',
  'deepseek',
];

// Modelo default por provider. Pra esta tarefa, preferimos modelos
// "sonnet/full" em vez de mini/flash — vale o custo extra pela qualidade
// dos insights numa análise que roda 1x/dia ou 1x/semana.
const DEFAULT_MODELS: Record<IntegrationType, string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-pro',
  mistral: 'mistral-large-latest',
  groq: 'llama-3.1-70b-versatile',
  xai: 'grok-2-latest',
  deepseek: 'deepseek-chat',
};

// ----------------------------------------------------------------------------
// Stats locais (versão simplificada do statsCalculator.ts do frontend).
// Idealmente seriam compartilhados, mas Deno + Vite alias é complicação.
// Mantemos focado nas distribuições e cruzamentos chave.
// ----------------------------------------------------------------------------

interface Interview {
  vote_intention: string;
  age_range: string | null;
  gender: string | null;
  religion: string | null;
  income_range: string | null;
  education: string | null;
  municipality_code: string | null;
  priority_themes: string[] | null;
  state_gov_rating: string | null;
  federal_gov_rating: string | null;
  city_gov_rating: string | null;
  neighborhood_complaint: string | null;
  conversion_argument: string | null;
  candidate_opinion: string | null;
  neighborhood: string | null;
  main_city_problem: string | null;
  status: string;
}

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}

function tally(items: Interview[], keyOf: (i: Interview) => string | null) {
  const m = new Map<string, number>();
  for (const i of items) {
    const k = keyOf(i);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function toDist(m: Map<string, number>, total: number) {
  return [...m.entries()]
    .map(([label, count]) => ({ label, count, pct: pct(count, total) }))
    .sort((a, b) => b.count - a.count);
}

function crossTab(
  items: Interview[],
  rowOf: (i: Interview) => string | null,
  colOf: (i: Interview) => string | null,
) {
  const m = new Map<string, Map<string, number>>();
  for (const it of items) {
    const r = rowOf(it);
    const c = colOf(it);
    if (!r || !c) continue;
    if (!m.has(r)) m.set(r, new Map());
    const row = m.get(r)!;
    row.set(c, (row.get(c) ?? 0) + 1);
  }
  const rows = [];
  for (const [r, row] of m.entries()) {
    let total = 0;
    for (const v of row.values()) total += v;
    const cells = [...row.entries()]
      .map(([colKey, count]) => ({ colKey, count, pct: pct(count, total) }))
      .sort((a, b) => b.pct - a.pct);
    rows.push({ rowKey: r, total, cells });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

function themesRanking(items: Interview[]) {
  const m = new Map<string, number>();
  for (const i of items) {
    for (const t of i.priority_themes ?? []) m.set(t, (m.get(t) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([theme, count]) => ({ theme, count, pct: pct(count, items.length) }))
    .sort((a, b) => b.count - a.count);
}

const GOV_NUM: Record<string, number> = {
  pessimo: 1,
  ruim: 2,
  regular: 3,
  bom: 4,
  otimo: 5,
};

function avgGov(items: Interview[], key: keyof Interview): number | null {
  let s = 0;
  let n = 0;
  for (const i of items) {
    const v = i[key] as string | null;
    if (v && GOV_NUM[v]) {
      s += GOV_NUM[v];
      n += 1;
    }
  }
  return n ? Math.round((s / n) * 10) / 10 : null;
}

function computeStats(items: Interview[]) {
  return {
    total: items.length,
    vote_intention_dist: toDist(tally(items, (i) => i.vote_intention), items.length),
    age_dist: toDist(tally(items, (i) => i.age_range), items.filter((i) => i.age_range).length),
    gender_dist: toDist(tally(items, (i) => i.gender), items.filter((i) => i.gender).length),
    religion_dist: toDist(tally(items, (i) => i.religion), items.filter((i) => i.religion).length),
    income_dist: toDist(tally(items, (i) => i.income_range), items.filter((i) => i.income_range).length),
    education_dist: toDist(tally(items, (i) => i.education), items.filter((i) => i.education).length),
    crossings: {
      intention_by_age: crossTab(items, (i) => i.age_range, (i) => i.vote_intention),
      intention_by_religion: crossTab(items, (i) => i.religion, (i) => i.vote_intention),
      intention_by_income: crossTab(items, (i) => i.income_range, (i) => i.vote_intention),
      intention_by_gender: crossTab(items, (i) => i.gender, (i) => i.vote_intention),
      intention_by_municipality: crossTab(items, (i) => i.municipality_code, (i) => i.vote_intention),
      themes_by_intention: crossTab(
        items.flatMap((i) =>
          (i.priority_themes ?? []).map((t) => ({
            ...i,
            __theme: t,
          })),
        ) as unknown as Interview[],
        (i) => (i as unknown as { __theme: string }).__theme,
        (i) => i.vote_intention,
      ),
    },
    themes_ranking: themesRanking(items),
    gov_ratings: {
      state: avgGov(items, 'state_gov_rating'),
      federal: avgGov(items, 'federal_gov_rating'),
      city: avgGov(items, 'city_gov_rating'),
    },
  };
}

// ----------------------------------------------------------------------------
// Prompt builder + LLM adapters
// ----------------------------------------------------------------------------

function buildPrompt(
  stats: unknown,
  openAnswers: unknown,
  candidate: string,
  regional: string | null,
) {
  return `Você é especialista sênior em marketing eleitoral brasileiro com 20 anos de experiência (Datafolha, Quaest). Analise os dados de pesquisa eleitoral abaixo de uma campanha de deputado estadual em MG e gere JSON estrito (sem markdown, sem comentários).

CANDIDATO: ${candidate}

ESTATÍSTICAS:
${JSON.stringify(stats, null, 2)}

AMOSTRA DE RESPOSTAS ABERTAS:
${JSON.stringify(openAnswers, null, 2)}
${regional ? `\n${regional}\n` : ''}
Devolva no formato:
{
  "resumo_executivo": "2-3 frases sobre o momento da campanha",
  "campaign_health_score": número 0-100,
  "conversion_probability": número 0.0-1.0,
  "strategic_insights": [{"titulo":"","insight":"","dado_de_suporte":"","impacto":"alto|medio|baixo","categoria":"base|territorio|mensagem|equipe|risco"}],
  "segmentos_prioritarios": [{"segmento":"","tamanho_pct":number,"potencial":"alto|medio|baixo","mensagem_recomendada":"","canal_preferencial":"WhatsApp|presencial|redes|evento"}],
  "temas_criticos": [{"tema":"","frequencia_pct":number,"sentimento":"positivo|neutro|negativo","acao_recomendada":"","urgencia":"imediata|esta_semana|este_mes"}],
  "risk_alerts": [{"alerta":"","evidencia":"","severidade":"critico|alto|medio","acao_mitigadora":""}],
  "opportunities": [{"oportunidade":"","potencial_votos":"","como_capturar":"","prazo":""}],
  "agenda_recomendada": [{"acao":"","justificativa":"","local_sugerido":"","publico_alvo":"","prioridade":1-5}],
  "mensagens_por_segmento": {"evangelicos":"","jovens_16_24":"","mulheres_35_44":"","baixa_renda":"","indecisos_saude":""},
  "comparacao_institutos": {"metodologia":"","margem_erro_estimada":"","confiabilidade":"","ressalvas":""}
}`;
}

async function callAnthropic(prompt: string, key: string, model: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
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
    case 'openai': return 'https://api.openai.com/v1';
    case 'mistral': return 'https://api.mistral.ai/v1';
    case 'groq': return 'https://api.groq.com/openai/v1';
    case 'xai': return 'https://api.x.ai/v1';
    case 'deepseek': return 'https://api.deepseek.com';
    default: return 'https://api.openai.com/v1';
  }
}

// ----------------------------------------------------------------------------
// Perguntas regionais (Bloco 6) — agrega e formata pro contexto da IA.
// ----------------------------------------------------------------------------
function rpct(c: number, t: number) {
  return t ? Math.round((c / t) * 100) : 0;
}

// deno-lint-ignore no-explicit-any
function aggregateRegional(type: string, answers: any[]): { total: number; text: string } {
  if (type === 'yes_no' || type === 'single_choice') {
    const valid = answers.filter((a) => a.answer_option);
    const m = new Map<string, number>();
    for (const a of valid) m.set(a.answer_option, (m.get(a.answer_option) ?? 0) + 1);
    const parts = [...m.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([k, c]) => `${k}: ${c} (${rpct(c, valid.length)}%)`);
    return { total: valid.length, text: parts.join(', ') };
  }
  if (type === 'multiple_choice') {
    const valid = answers.filter(
      (a) => Array.isArray(a.answer_options) && a.answer_options.length > 0,
    );
    const m = new Map<string, number>();
    for (const a of valid) for (const o of a.answer_options) m.set(o, (m.get(o) ?? 0) + 1);
    const parts = [...m.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([k, c]) => `${k}: ${c} (${rpct(c, valid.length)}% dos respondentes)`);
    return { total: valid.length, text: parts.join(', ') };
  }
  if (type === 'scale_1_5') {
    const valid = answers.filter((a) => a.answer_scale != null);
    const m = new Map<number, number>();
    let sum = 0;
    for (const a of valid) {
      m.set(a.answer_scale, (m.get(a.answer_scale) ?? 0) + 1);
      sum += a.answer_scale;
    }
    const avg = valid.length ? Math.round((sum / valid.length) * 10) / 10 : 0;
    const parts = [5, 4, 3, 2, 1].map(
      (n) => `${n}: ${m.get(n) ?? 0} (${rpct(m.get(n) ?? 0, valid.length)}%)`,
    );
    return { total: valid.length, text: `média ${avg}/5 — ${parts.join(', ')}` };
  }
  // free_text
  const valid = answers.filter((a) => a.answer_text && String(a.answer_text).trim());
  const m = new Map<string, { label: string; c: number }>();
  for (const a of valid) {
    const norm = String(a.answer_text).trim().toLowerCase();
    const e = m.get(norm);
    if (e) e.c += 1;
    else m.set(norm, { label: String(a.answer_text).trim(), c: 1 });
  }
  const top = [...m.values()]
    .sort((x, y) => y.c - x.c)
    .slice(0, 10)
    .map((e) => `"${e.label}" (${e.c}, ${rpct(e.c, valid.length)}%)`);
  return { total: valid.length, text: top.join(', ') };
}

// deno-lint-ignore no-explicit-any
async function buildRegionalContext(admin: any, campaignId: string): Promise<string | null> {
  const { data: perguntas } = await admin
    .from('campaign_questions')
    .select('id, text, type, options')
    .eq('campaign_id', campaignId)
    .eq('is_active', true)
    .order('sort_order');
  if (!perguntas || perguntas.length === 0) return null;

  const { data: respostas } = await admin
    .from('interview_custom_answers')
    .select('question_id, answer_text, answer_option, answer_options, answer_scale')
    .eq('campaign_id', campaignId);
  const answers = respostas ?? [];
  if (answers.length === 0) return null;

  // deno-lint-ignore no-explicit-any
  const byQ = new Map<string, any[]>();
  for (const a of answers) {
    const arr = byQ.get(a.question_id) ?? [];
    arr.push(a);
    byQ.set(a.question_id, arr);
  }

  const blocks: string[] = [];
  let idx = 0;
  for (const q of perguntas) {
    const ans = byQ.get(q.id) ?? [];
    if (ans.length === 0) continue; // só perguntas que têm respostas
    idx += 1;
    const agg = aggregateRegional(q.type, ans);
    blocks.push(
      `${idx}. ${q.text}\n   Tipo: ${q.type}\n   ${agg.total} respostas coletadas\n   Distribuição: ${agg.text}`,
    );
  }
  if (blocks.length === 0) return null;

  return `PERGUNTAS REGIONAIS DESTA CAMPANHA (perguntas específicas do contexto local — analisar com atenção pois refletem particularidades do território):\n\n${blocks.join('\n\n')}`;
}

// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !service) return json({ error: 'envs ausentes' }, 500);

    const auth = req.headers.get('authorization') ?? '';
    const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, service);

    const { data: userData } = await caller.auth.getUser();
    if (!userData?.user) return json({ error: 'unauthorized' }, 401);

    const body = (await req.json()) as { campaign_id: string };
    if (!body.campaign_id) return json({ error: 'campaign_id obrigatório' }, 400);

    const { data: interviews, error: iErr } = await caller
      .from('field_interviews')
      .select('vote_intention, age_range, gender, religion, income_range, education, municipality_code, priority_themes, state_gov_rating, federal_gov_rating, city_gov_rating, neighborhood_complaint, conversion_argument, candidate_opinion, neighborhood, main_city_problem, status')
      .eq('campaign_id', body.campaign_id)
      .neq('status', 'draft');
    if (iErr) return json({ error: iErr.message }, 500);
    const list = (interviews ?? []) as Interview[];

    if (list.length < 10) {
      return json({ error: 'Mínimo 10 entrevistas para análise significativa.' }, 400);
    }

    const stats = computeStats(list);
    const openAnswers = list
      .filter((i) => i.neighborhood_complaint || i.conversion_argument)
      .slice(0, 200)
      .map((i) => ({
        bairro: i.neighborhood ?? i.municipality_code,
        intencao: i.vote_intention,
        problema_principal: i.main_city_problem,
        argumento_conversao: i.conversion_argument,
        reclamacao: i.neighborhood_complaint,
        perfil: `${i.age_range ?? '?'} | ${i.gender ?? '?'} | ${i.religion ?? '?'} | ${i.income_range ?? '?'}`,
      }));

    // Resolve provider
    const { data: featureCfg } = await admin
      .from('ai_feature_config')
      .select('integration_id, model')
      .eq('campaign_id', body.campaign_id)
      .eq('feature', 'campaign_intelligence')
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
      // Sem ai_feature_config explícito: percorre PROVIDER_PRIORITY e usa o
      // PRIMEIRO da lista que estiver habilitado pra essa campanha.
      // Resultado: se a campanha tiver Anthropic + OpenAI, sempre escolhe
      // Anthropic (melhor pra essa tarefa). Se só tiver Gemini, usa Gemini.
      const { data: ints } = await admin
        .from('integrations')
        .select('type, config')
        .eq('campaign_id', body.campaign_id)
        .eq('is_enabled', true);
      for (const preferred of PROVIDER_PRIORITY) {
        const match = ints?.find((i) => i.type === preferred);
        if (match) {
          providerType = preferred;
          apiKey = String((match.config as Record<string, unknown>)?.api_key ?? '');
          model = DEFAULT_MODELS[preferred];
          baseUrl = String((match.config as Record<string, unknown>)?.base_url ?? '');
          break;
        }
      }
    }

    let aiPayload: Record<string, unknown> | null = null;
    let raw: string | null = null;

    if (providerType && apiKey) {
      const { data: camp } = await admin
        .from('campaigns')
        .select('candidate_name')
        .eq('id', body.campaign_id)
        .single();
      const candidate = camp?.candidate_name ?? 'o candidato';
      // Perguntas regionais (Bloco 6) no contexto da IA — só se houver com respostas.
      const regional = await buildRegionalContext(admin, body.campaign_id);
      const prompt = buildPrompt(stats, openAnswers, candidate, regional);
      try {
        if (providerType === 'anthropic') raw = await callAnthropic(prompt, apiKey, model);
        else if (providerType === 'gemini') raw = await callGemini(prompt, apiKey, model);
        else raw = await callOpenAi(prompt, apiKey, model, baseUrl || defaultBase(providerType));
        aiPayload = safeParse(raw);
      } catch (err) {
        raw = `IA falhou: ${err instanceof Error ? err.message : 'erro'}`;
        aiPayload = null;
      }
    }

    // Persiste (usa admin pra inserir com campaign_id explícito)
    const row = {
      campaign_id: body.campaign_id,
      total_interviews: list.length,
      vote_intention_dist: stats.vote_intention_dist,
      age_dist: stats.age_dist,
      gender_dist: stats.gender_dist,
      religion_dist: stats.religion_dist,
      income_dist: stats.income_dist,
      education_dist: stats.education_dist,
      crossings: stats.crossings,
      themes_ranking: stats.themes_ranking,
      gov_ratings: stats.gov_ratings,
      resumo_executivo: aiPayload?.resumo_executivo ?? null,
      strategic_insights: aiPayload?.strategic_insights ?? [],
      risk_alerts: aiPayload?.risk_alerts ?? [],
      opportunities: aiPayload?.opportunities ?? [],
      recommended_actions: aiPayload?.agenda_recomendada ?? [],
      mensagens_por_segmento: aiPayload?.mensagens_por_segmento ?? null,
      comparacao_institutos: aiPayload?.comparacao_institutos ?? null,
      campaign_health_score: aiPayload?.campaign_health_score ?? null,
      conversion_probability: aiPayload?.conversion_probability ?? null,
      raw_analysis: raw,
    };

    const { data: inserted, error: insErr } = await admin
      .from('campaign_intelligence')
      .insert(row)
      .select('id')
      .single();
    if (insErr) return json({ error: insErr.message }, 500);
    return json({ id: inserted?.id, ai_used: !!aiPayload });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'erro' }, 500);
  }
});
