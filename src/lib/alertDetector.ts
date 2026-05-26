// Detectores automáticos da Central de Alertas.
//
// Cada detector é uma função pura que recebe os dados da campanha e devolve
// uma lista de "drafts" de alerta. O hook useAlertas faz a deduplicação via
// `dedup_key` e o upsert na tabela `alerts`.

import type {
  Alert,
  AlertPriority,
  AlertType,
  CampaignEvent,
  CampaignUser,
  FieldInterview,
  Mention,
  Supporter,
  Voter,
} from '@/types';
import { MUNI_COORDS } from '@/data/municipalities-mg-coords';
import { regionOf, type MgRegion } from '@/data/regions-mg';

const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;

export interface DetectorInput {
  supporters: Supporter[];
  voters: Voter[];
  interviews: FieldInterview[];
  events: CampaignEvent[];
  mentions: Mention[];
  members: CampaignUser[];
  voteTarget: number;
}

export type AlertDraft = Pick<
  Alert,
  | 'type'
  | 'priority'
  | 'title'
  | 'description'
  | 'acao_sugerida'
  | 'acao_label'
  | 'acao_route'
  | 'meta'
  | 'dedup_key'
  | 'message'
  | 'expires_at'
>;

interface DraftConfig {
  type: AlertType;
  priority: AlertPriority;
  title: string;
  description: string;
  acao_sugerida?: string;
  acao_label?: string;
  acao_route?: string;
  meta?: Record<string, unknown>;
  dedup_key: string;
  expires_at?: string;
}

function draft(c: DraftConfig): AlertDraft {
  return {
    type: c.type,
    priority: c.priority,
    title: c.title,
    description: c.description,
    acao_sugerida: c.acao_sugerida ?? null,
    acao_label: c.acao_label ?? null,
    acao_route: c.acao_route ?? null,
    meta: c.meta ?? null,
    dedup_key: c.dedup_key,
    message: c.title, // legacy compatibility
    expires_at: c.expires_at ?? null,
  };
}

function muniName(code: string | null | undefined): string {
  if (!code) return 'Município';
  return MUNI_COORDS[code]?.name ?? 'Município';
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - +new Date(iso)) / MS_DAY);
}

function hoursAgo(iso: string): number {
  return (Date.now() - +new Date(iso)) / MS_HOUR;
}

// ---------------------------------------------------------------------------
// Detectores
// ---------------------------------------------------------------------------

function detectMunicipioSemVisita(input: DetectorInput): AlertDraft[] {
  const muniWith = new Set<string>();
  for (const s of input.supporters) if (s.municipality_code) muniWith.add(s.municipality_code);
  for (const v of input.voters) if (v.municipality_code) muniWith.add(v.municipality_code);

  const out: AlertDraft[] = [];
  for (const code of muniWith) {
    const visitsHere = input.interviews
      .filter((i) => i.municipality_code === code)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    const last = visitsHere[0];
    const days = last ? daysAgo(last.created_at) : 999;
    if (days < 14) continue;
    const supportersHere = input.supporters.filter((s) => s.municipality_code === code).length;
    out.push(
      draft({
        type: 'municipio_sem_visita',
        priority: 'critico',
        title: `${muniName(code)} sem visita há ${days} dias`,
        description: `Cabo eleitoral pode ter desistido. ${supportersHere} lideranças em risco.`,
        acao_sugerida: 'Contate o coordenador regional e redistribua a cobertura.',
        acao_label: 'Ver no mapa',
        acao_route: '/mapa',
        meta: { municipality_code: code, days, supporters: supportersHere },
        dedup_key: `municipio_sem_visita:${code}`,
      }),
    );
  }
  return out;
}

function detectMencaoViralNegativa(input: DetectorInput): AlertDraft[] {
  const now = Date.now();
  // últimas 2h, sentimento muito negativo
  const recent = input.mentions.filter(
    (m) =>
      m.sentiment === 'negativo' &&
      m.sentiment_score < -0.7 &&
      now - +new Date(m.published_at) <= 2 * MS_HOUR,
  );
  // últimas 24h como baseline
  const last24h = input.mentions.filter(
    (m) =>
      m.sentiment === 'negativo' &&
      now - +new Date(m.published_at) <= 24 * MS_HOUR,
  );
  const baselinePerHour = last24h.length / 24;

  if (recent.length === 0) return [];
  // Considera viral se acima de 3x a média
  if (recent.length / 2 < Math.max(1, baselinePerHour) * 3) return [];

  const lastHour = recent.filter((m) => now - +new Date(m.published_at) <= MS_HOUR);
  // Pega a menção MAIS negativa pra abrir o stepper já apontando pra ela
  const top = [...recent].sort((a, b) => a.sentiment_score - b.sentiment_score)[0];
  return [
    draft({
      type: 'mencao_viral_negativa',
      priority: 'urgente',
      title: `${lastHour.length} menções negativas na última hora`,
      description: `Pico de ${recent.length} ataques nas últimas 2h — janela de resposta antes de escalar.`,
      acao_sugerida: 'Acesse o monitor de menções e use os insights de IA para redigir resposta.',
      acao_label: 'Responder agora',
      acao_route: top ? `/mencoes/resposta-rapida?mention=${top.id}` : '/mencoes/resposta-rapida',
      meta: {
        window_hours: 2,
        count: recent.length,
        baseline_per_hour: Number(baselinePerHour.toFixed(2)),
        top_mention_id: top?.id ?? null,
      },
      dedup_key: `mencao_viral_negativa:${new Date().toISOString().slice(0, 13)}`, // dedup por hora
      expires_at: new Date(now + 2 * MS_HOUR).toISOString(),
    }),
  ];
}

function detectSpikeNegativoMencoes(input: DetectorInput): AlertDraft[] {
  // Variante mais "leve" de mencao_viral_negativa: aumento moderado
  const now = Date.now();
  const lastHour = input.mentions.filter(
    (m) => m.sentiment === 'negativo' && now - +new Date(m.published_at) <= MS_HOUR,
  );
  const last24h = input.mentions.filter(
    (m) => m.sentiment === 'negativo' && now - +new Date(m.published_at) <= 24 * MS_HOUR,
  );
  const baseline = last24h.length / 24;
  if (lastHour.length === 0 || baseline === 0) return [];
  const ratio = lastHour.length / Math.max(1, baseline);
  if (ratio < 1.5 || ratio >= 3) return []; // 1.5-3x: spike moderado
  const top = [...lastHour].sort((a, b) => a.sentiment_score - b.sentiment_score)[0];
  return [
    draft({
      type: 'spike_negativo_mencoes',
      priority: 'atencao',
      title: 'Aumento de menções negativas',
      description: `${lastHour.length} na última hora — ${ratio.toFixed(1)}x a média 24h.`,
      acao_sugerida: 'Monitore o feed; prepare resposta se piorar.',
      acao_label: 'Responder',
      acao_route: top ? `/mencoes/resposta-rapida?mention=${top.id}` : '/mencoes',
      meta: { ratio: Number(ratio.toFixed(2)), top_mention_id: top?.id ?? null },
      dedup_key: `spike_negativo_mencoes:${new Date().toISOString().slice(0, 13)}`,
    }),
  ];
}

function detectLiderancaInativa(input: DetectorInput): AlertDraft[] {
  // Lideranças (role=lider, status=ativo) sem atividade nos últimos 21 dias.
  // Como não temos last_login no Supporter, usamos created_at como proxy ou
  // a presença em entrevistas (criou alguma entrevista nos últimos 21d?).
  const cutoff = Date.now() - 21 * MS_DAY;
  const leaders = input.supporters.filter(
    (s) => s.role === 'lider' && s.status === 'ativo',
  );
  return leaders
    .filter((l) => +new Date(l.created_at) < cutoff)
    .map((l) =>
      draft({
        type: 'lideranca_inativa',
        priority: 'critico',
        title: `Liderança ${l.name} sem atividade`,
        description: `${l.city ?? 'Sem cidade'} — pode ter migrado ao concorrente. Verifique urgente.`,
        acao_sugerida: 'Ligue pessoalmente ou envie cabo eleitoral para visita.',
        acao_label: 'Ver lideranças',
        acao_route: '/liderancas',
        meta: { supporter_id: l.id, days: daysAgo(l.created_at) },
        dedup_key: `lideranca_inativa:${l.id}`,
      }),
    );
}

function detectMetaMunicipioBaixa(input: DetectorInput): AlertDraft[] {
  // Para cada município com cadastros, calcula força aproximada (mesma fórmula
  // do pulse.ts) e dispara alerta se < 60 (numa escala 0-100 dentro do município).
  const codes = new Set<string>();
  for (const s of input.supporters) if (s.municipality_code) codes.add(s.municipality_code);
  for (const v of input.voters) if (v.municipality_code) codes.add(v.municipality_code);

  const out: AlertDraft[] = [];
  for (const code of codes) {
    const sHere = input.supporters.filter((s) => s.municipality_code === code);
    const vHere = input.voters.filter((v) => v.municipality_code === code);
    const supportersHere = sHere.length;
    const apoiadoresHere = vHere.filter((v) => v.vote_intention === 'apoiador').length;
    // Heurística: 20 lideranças + 50 apoiadores = 100 (totalmente coberto)
    const strength = Math.min(
      100,
      Math.round((supportersHere / 20) * 50 + (apoiadoresHere / 50) * 50),
    );
    if (strength >= 60) continue;
    out.push(
      draft({
        type: 'meta_municipio_baixa',
        priority: 'atencao',
        title: `${muniName(code)} abaixo de 60% da meta`,
        description: `${strength}% atingido. Faltam ${Math.max(0, 50 - apoiadoresHere)} eleitores apoiadores mapeados.`,
        acao_sugerida: 'Reforce equipe de campo nessa região nas próximas 2 semanas.',
        acao_label: 'Ver região',
        acao_route: '/mapa',
        meta: { municipality_code: code, strength_pct: strength },
        dedup_key: `meta_municipio_baixa:${code}`,
      }),
    );
  }
  return out;
}

function detectMunicipioSemLideranca(input: DetectorInput): AlertDraft[] {
  // Municípios com eleitores cadastrados mas sem nenhuma liderança.
  const muniSupporters = new Set<string>();
  for (const s of input.supporters) {
    if (s.municipality_code && (s.role === 'lider' || s.role === 'cabo')) {
      muniSupporters.add(s.municipality_code);
    }
  }
  const muniVoters = new Set<string>();
  for (const v of input.voters) if (v.municipality_code) muniVoters.add(v.municipality_code);

  const orphans = [...muniVoters].filter((c) => !muniSupporters.has(c));
  return orphans.map((code) => {
    const votersHere = input.voters.filter((v) => v.municipality_code === code).length;
    return draft({
      type: 'municipio_sem_lideranca',
      priority: 'atencao',
      title: `${muniName(code)} sem liderança formal`,
      description: `${votersHere} eleitores cadastrados, mas nenhum líder ou cabo na região.`,
      acao_sugerida: 'Identifique e cadastre uma liderança local antes que a base se disperse.',
      acao_label: 'Cadastrar liderança',
      acao_route: '/liderancas',
      meta: { municipality_code: code, voters: votersHere },
      dedup_key: `municipio_sem_lideranca:${code}`,
    });
  });
}

function detectEventoSemConfirmacao(input: DetectorInput): AlertDraft[] {
  // Eventos nos próximos 3 dias. Como não temos "confirmados", consideramos
  // que um evento sem descrição preenchida ainda não foi articulado.
  const now = Date.now();
  const in3d = now + 3 * MS_DAY;
  return input.events
    .filter((e) => {
      const t = +new Date(e.date);
      return t >= now && t <= in3d && (!e.description || e.description.trim().length < 20);
    })
    .map((e) =>
      draft({
        type: 'evento_sem_confirmacao',
        priority: 'atencao',
        title: `Evento sem articulação: "${e.title}"`,
        description: `${formatDate(e.date)} em ${e.city ?? 'sem cidade'}. Risco de plateia vazia.`,
        acao_sugerida: 'Acione cabo eleitoral local para confirmar presença de apoiadores.',
        acao_label: 'Ver evento',
        acao_route: '/agenda',
        meta: { event_id: e.id, date: e.date },
        dedup_key: `evento_sem_confirmacao:${e.id}`,
      }),
    );
}

function detectCaboSumido(input: DetectorInput): AlertDraft[] {
  // Cabos (campaign_users com role='field_agent') sem entrevista nos últimos 7d.
  const cutoff = Date.now() - 7 * MS_DAY;
  const recentByAgent = new Map<string, number>();
  for (const i of input.interviews) {
    if (+new Date(i.created_at) >= cutoff) {
      recentByAgent.set(i.created_by, (recentByAgent.get(i.created_by) ?? 0) + 1);
    }
  }
  const sumidos = input.members
    .filter((m) => m.role === 'field_agent' && m.is_active)
    .filter((m) => !recentByAgent.has(m.user_id));

  if (sumidos.length === 0) return [];
  return [
    draft({
      type: 'cabo_sumido',
      priority: 'atencao',
      title: `${sumidos.length} cabo${sumidos.length > 1 ? 's' : ''} eleitora${sumidos.length > 1 ? 'is' : 'l'} sem atividade há 7+ dias`,
      description: 'Sem registros de entrevista nesta semana. Verifique se ainda estão ativos.',
      acao_sugerida: 'Contate os coordenadores regionais para reativar ou substituir.',
      acao_label: 'Ver equipe',
      acao_route: '/equipe',
      meta: { user_ids: sumidos.map((s) => s.user_id) },
      dedup_key: 'cabo_sumido:weekly',
    }),
  ];
}

function detectEntrevistasParadas(input: DetectorInput): AlertDraft[] {
  // Se já passou das 10h e ainda 0 entrevistas hoje
  const now = new Date();
  if (now.getHours() < 10) return [];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const today = input.interviews.filter((i) => +new Date(i.created_at) >= start.getTime());
  if (today.length > 0) return [];
  return [
    draft({
      type: 'entrevistas_paradas',
      priority: 'critico',
      title: 'Nenhuma entrevista de campo hoje',
      description: 'Equipe parou completamente. Meta diária em risco.',
      acao_sugerida: 'Acione todos os coordenadores regionais imediatamente.',
      acao_label: 'Ver equipe',
      acao_route: '/equipe',
      meta: { date: start.toISOString().slice(0, 10) },
      dedup_key: `entrevistas_paradas:${start.toISOString().slice(0, 10)}`,
      expires_at: new Date(start.getTime() + MS_DAY).toISOString(),
    }),
  ];
}

function detectMetaGeralCritica(input: DetectorInput): AlertDraft[] {
  if (input.voteTarget <= 0) return [];
  let estimate = 0;
  for (const s of input.supporters) {
    if (s.role === 'lider') estimate += 35;
    else if (s.role === 'cabo') estimate += 12;
    else if (s.role === 'militante') estimate += 5;
    else estimate += 2;
  }
  for (const v of input.voters) {
    if (v.vote_intention === 'apoiador') estimate += 1;
    else if (v.vote_intention === 'tendencia_apoio') estimate += 0.6;
  }
  const progress = estimate / input.voteTarget;
  if (progress >= 0.5) return [];
  return [
    draft({
      type: 'meta_geral_critica',
      priority: 'critico',
      title: `Meta de votos em ${Math.round(progress * 100)}%`,
      description: `${Math.round(estimate)} estimados contra ${input.voteTarget} de meta. Margem perigosa.`,
      acao_sugerida: 'Revise plano estratégico em conjunto com coordenação geral.',
      acao_label: 'Ver dashboard',
      acao_route: '/dashboard',
      meta: { estimate: Math.round(estimate), target: input.voteTarget },
      dedup_key: 'meta_geral_critica:total',
    }),
  ];
}

// Mantém referência (silencia lint):
void hoursAgo;

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export function detectAll(input: DetectorInput): AlertDraft[] {
  return [
    ...detectMencaoViralNegativa(input),
    ...detectEntrevistasParadas(input),
    ...detectMunicipioSemVisita(input),
    ...detectLiderancaInativa(input),
    ...detectMetaGeralCritica(input),
    ...detectMunicipioSemLideranca(input),
    ...detectMetaMunicipioBaixa(input),
    ...detectEventoSemConfirmacao(input),
    ...detectCaboSumido(input),
    ...detectSpikeNegativoMencoes(input),
  ];
}

// Helper para detectores expostos individualmente em testes futuros
export const detectors = {
  detectMunicipioSemVisita,
  detectMencaoViralNegativa,
  detectSpikeNegativoMencoes,
  detectLiderancaInativa,
  detectMetaMunicipioBaixa,
  detectMunicipioSemLideranca,
  detectEventoSemConfirmacao,
  detectCaboSumido,
  detectEntrevistasParadas,
  detectMetaGeralCritica,
};

// Aggregations úteis pro client
export function bucketByPriority(alerts: Alert[]): Record<AlertPriority, Alert[]> {
  const empty: Record<AlertPriority, Alert[]> = {
    urgente: [],
    critico: [],
    atencao: [],
    info: [],
  };
  for (const a of alerts) {
    empty[a.priority].push(a);
  }
  return empty;
}

export function ageByRegion(input: DetectorInput): Record<MgRegion | 'sem_regiao', number> {
  const out: Record<string, number> = {};
  for (const s of input.supporters) {
    const r = regionOf(s.municipality_code) ?? 'sem_regiao';
    out[r] = (out[r] ?? 0) + 1;
  }
  return out as Record<MgRegion | 'sem_regiao', number>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
