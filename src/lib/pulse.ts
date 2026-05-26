// Cálculos do Painel Estratégico — Pulso da Campanha, Sinais e Radar Semanal.
//
// Pulso (0-100) é média ponderada de 5 dimensões:
//   - crescimento da base (25%)
//   - cobertura de municípios (20%)
//   - sentimento de menções (25%)
//   - atividade da equipe de campo (15%)
//   - meta de votos atingida (15%)
//
// Sinais são gerados a partir das mesmas métricas com regras simples.
// Radar mostra 6 eixos comparando 7d atual vs 7d anteriores.

import type {
  CampaignEvent,
  FieldInterview,
  Mention,
  Supporter,
  Voter,
} from '@/types';
import { knownMunicipalitiesMG } from '@/lib/metrics';
import { regionOf } from '@/data/regions-mg';

export type SignalLevel = 'good' | 'warn' | 'critical' | 'urgent';

export interface PulseInput {
  supporters: Supporter[];
  voters: Voter[];
  interviews: FieldInterview[];
  events: CampaignEvent[];
  mentions: Mention[];
  voteTarget: number;
  members: number; // total de membros ativos da equipe
}

export interface PulseScore {
  total: number; // 0-100
  delta: number; // vs semana anterior
  band: 'critical' | 'warn' | 'progress' | 'strong';
  bandLabel: string;
  dimensions: {
    growth: number;
    coverage: number;
    sentiment: number;
    fieldActivity: number;
    targetProgress: number;
  };
}

export interface CampaignSignal {
  id: string;
  level: SignalLevel;
  title: string;
  description: string;
  cta?: { label: string; to: string };
}

export interface RadarPoint {
  axis: string;
  current: number;
  previous: number;
}

const MS_DAY = 86_400_000;

function within(iso: string, fromAgoDays: number, toAgoDays: number): boolean {
  const t = +new Date(iso);
  const now = Date.now();
  const fromMs = now - fromAgoDays * MS_DAY;
  const toMs = now - toAgoDays * MS_DAY;
  return t >= toMs && t <= fromMs;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Pulso
// ---------------------------------------------------------------------------

export function computePulse(input: PulseInput): PulseScore {
  const dims = {
    growth: scoreGrowth(input.supporters, input.voters),
    coverage: scoreCoverage(input.supporters, input.voters),
    sentiment: scoreSentiment(input.mentions),
    fieldActivity: scoreFieldActivity(input.interviews, input.members),
    targetProgress: scoreTargetProgress(input.supporters, input.voters, input.voteTarget),
  };

  const total = clamp(
    Math.round(
      dims.growth * 0.25 +
        dims.coverage * 0.2 +
        dims.sentiment * 0.25 +
        dims.fieldActivity * 0.15 +
        dims.targetProgress * 0.15,
    ),
  );

  // Delta: recomputa apenas growth/sentiment/field para "semana anterior"
  const previousGrowth = scoreGrowth(input.supporters, input.voters, 7, 14);
  const previousSentiment = scoreSentiment(input.mentions, 7, 14);
  const previousField = scoreFieldActivity(input.interviews, input.members, 7, 14);
  const previousApprox = clamp(
    Math.round(
      previousGrowth * 0.25 +
        dims.coverage * 0.2 + // coverage muda pouco semana-a-semana
        previousSentiment * 0.25 +
        previousField * 0.15 +
        dims.targetProgress * 0.15,
    ),
  );

  const delta = total - previousApprox;

  const band = pulseBand(total);
  return {
    total,
    delta,
    band,
    bandLabel:
      band === 'critical' ? 'Crítico' : band === 'warn' ? 'Atenção' : band === 'progress' ? 'No caminho' : 'Forte',
    dimensions: dims,
  };
}

export function pulseBand(total: number): PulseScore['band'] {
  if (total < 40) return 'critical';
  if (total < 60) return 'warn';
  if (total < 80) return 'progress';
  return 'strong';
}

export function pulseBandColor(band: PulseScore['band']): string {
  switch (band) {
    case 'critical':
      return '#EF4444';
    case 'warn':
      return '#F97316';
    case 'progress':
      return '#F59E0B';
    case 'strong':
      return '#A3E635';
  }
}

// --- Dimensões ---------------------------------------------------------------

function scoreGrowth(
  supporters: Supporter[],
  voters: Voter[],
  fromDays = 7,
  toDays = 0,
): number {
  const itemsThis = [...supporters, ...voters].filter((r) =>
    within(r.created_at, fromDays, toDays),
  );
  const itemsPrev = [...supporters, ...voters].filter((r) =>
    within(r.created_at, fromDays * 2, toDays + fromDays),
  );
  const curr = itemsThis.length;
  const prev = itemsPrev.length;
  if (prev === 0) return curr === 0 ? 50 : 80;
  const growth = (curr - prev) / prev; // pode ser negativo
  // 0% crescimento → 50; 10% → 75; 20%+ → 100; -10% → 25
  return clamp(50 + growth * 250);
}

function scoreCoverage(supporters: Supporter[], voters: Voter[]): number {
  const set = new Set<string>();
  for (const s of supporters) if (s.municipality_code) set.add(s.municipality_code);
  for (const v of voters) if (v.municipality_code) set.add(v.municipality_code);
  const total = knownMunicipalitiesMG(); // 36 cadastrados em mock; em prod, vir do banco
  return clamp((set.size / total) * 100);
}

function scoreSentiment(
  mentions: Mention[],
  fromDays = 7,
  toDays = 0,
): number {
  const recent = mentions.filter((m) => within(m.published_at, fromDays, toDays));
  if (recent.length === 0) return 60; // sem dados — neutro positivo
  const sum = recent.reduce((acc, m) => acc + m.sentiment_score, 0);
  const avg = sum / recent.length; // -1 a +1
  // -1 → 0; 0 → 50; +1 → 100
  return clamp((avg + 1) * 50);
}

function scoreFieldActivity(
  interviews: FieldInterview[],
  members: number,
  fromDays = 7,
  toDays = 0,
): number {
  const recent = interviews.filter((i) => within(i.created_at, fromDays, toDays));
  if (members === 0) return recent.length > 0 ? 60 : 40;
  // benchmark: 5 entrevistas/membro/semana = 100, 0 = 0
  const perMember = recent.length / members;
  return clamp((perMember / 5) * 100);
}

function scoreTargetProgress(
  supporters: Supporter[],
  voters: Voter[],
  voteTarget: number,
): number {
  if (voteTarget <= 0) return 50; // sem meta — neutro
  let estimate = 0;
  for (const s of supporters) {
    if (s.role === 'lider') estimate += 35;
    else if (s.role === 'cabo') estimate += 12;
    else if (s.role === 'militante') estimate += 5;
    else estimate += 2;
  }
  for (const v of voters) {
    if (v.vote_intention === 'apoiador') estimate += 1;
    else if (v.vote_intention === 'tendencia_apoio') estimate += 0.6;
  }
  return clamp((estimate / voteTarget) * 100);
}

// ---------------------------------------------------------------------------
// Sinais
// ---------------------------------------------------------------------------

const NUM = new Intl.NumberFormat('pt-BR');
const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

export function computeSignals(input: PulseInput): CampaignSignal[] {
  const out: CampaignSignal[] = [];

  // 1) Crescimento da base ----------------------------------------------------
  {
    const curr = [...input.supporters, ...input.voters].filter((r) => within(r.created_at, 7, 0)).length;
    const prev = [...input.supporters, ...input.voters].filter((r) => within(r.created_at, 14, 7)).length;
    const variation = prev > 0 ? (curr - prev) / prev : curr > 0 ? 1 : 0;
    if (variation > 0.05) {
      out.push({
        id: 'growth',
        level: 'good',
        title: `Base cresceu ${PCT.format(variation)} esta semana`,
        description: `${NUM.format(curr)} novos cadastros nos últimos 7 dias.`,
      });
    } else if (variation >= 0) {
      out.push({
        id: 'growth',
        level: 'warn',
        title: 'Crescimento lento esta semana',
        description: `Apenas ${NUM.format(curr)} novos cadastros — intensificar a captação.`,
      });
    } else {
      out.push({
        id: 'growth',
        level: 'critical',
        title: `Base encolheu ${PCT.format(-variation)}`,
        description: 'Verifique baixas e reativações pendentes.',
      });
    }
  }

  // 2) Regiões críticas -------------------------------------------------------
  {
    const weights = aggregateRegionStrength(input.supporters, input.voters);
    const critical = Object.entries(weights).filter(([, w]) => w < 30);
    if (critical.length === 0) {
      out.push({
        id: 'regions',
        level: 'good',
        title: 'Todas as regiões dentro da meta',
        description: 'Nenhuma região com força política abaixo de 30%.',
      });
    } else if (critical.length <= 2) {
      out.push({
        id: 'regions',
        level: 'warn',
        title: `${critical.length} regiões abaixo da meta`,
        description: `Atenção: ${critical.map(([r]) => r).join(', ')}.`,
        cta: { label: 'Ver no mapa', to: '/mapa' },
      });
    } else {
      out.push({
        id: 'regions',
        level: 'critical',
        title: `${critical.length} regiões críticas`,
        description: `Realocar equipe para ${critical
          .slice(0, 3)
          .map(([r]) => r)
          .join(', ')}.`,
        cta: { label: 'Ver no mapa', to: '/mapa' },
      });
    }
  }

  // 3) Menções negativas (última hora vs últimas 24h) -------------------------
  {
    const ONE_HOUR_MS = 3_600_000;
    const now = Date.now();
    const lastHour = input.mentions.filter(
      (m) => m.sentiment === 'negativo' && now - +new Date(m.published_at) <= ONE_HOUR_MS,
    );
    const last24h = input.mentions.filter(
      (m) => m.sentiment === 'negativo' && now - +new Date(m.published_at) <= 24 * ONE_HOUR_MS,
    );
    const baseline = last24h.length / 24; // por hora
    if (lastHour.length === 0 || baseline === 0) {
      out.push({
        id: 'mentions',
        level: 'good',
        title: 'Sem picos negativos nas últimas horas',
        description: `${NUM.format(last24h.length)} menções negativas nas últimas 24h.`,
      });
    } else if (lastHour.length / Math.max(1, baseline) > 3) {
      out.push({
        id: 'mentions',
        level: 'urgent',
        title: `${lastHour.length} menções negativas na última hora`,
        description: 'Pico anormal — considere resposta imediata.',
        cta: { label: 'Ver menções', to: '/mencoes' },
      });
    } else if (lastHour.length / Math.max(1, baseline) > 1.5) {
      out.push({
        id: 'mentions',
        level: 'warn',
        title: 'Aumento de menções negativas',
        description: `${lastHour.length} na última hora (média 24h: ${baseline.toFixed(1)}/h).`,
        cta: { label: 'Ver menções', to: '/mencoes' },
      });
    } else {
      out.push({
        id: 'mentions',
        level: 'good',
        title: 'Volume de menções dentro do esperado',
        description: `${lastHour.length} negativas na última hora.`,
      });
    }
  }

  // 4) Atividade da equipe de campo -------------------------------------------
  {
    const recent = input.interviews.filter((i) => within(i.created_at, 7, 0)).length;
    const activeRatio = input.members > 0 ? recent / Math.max(1, input.members) : 0;
    if (activeRatio >= 3) {
      out.push({
        id: 'team',
        level: 'good',
        title: 'Equipe de campo ativa',
        description: `${NUM.format(recent)} entrevistas registradas nos últimos 7 dias.`,
      });
    } else if (activeRatio >= 1) {
      out.push({
        id: 'team',
        level: 'warn',
        title: 'Atividade abaixo do esperado',
        description: `${NUM.format(recent)} entrevistas — acionar coordenadores.`,
      });
    } else {
      out.push({
        id: 'team',
        level: 'critical',
        title: 'Equipe parada',
        description: 'Risco de perder base. Cobrar agentes de campo imediatamente.',
        cta: { label: 'Ver equipe', to: '/equipe' },
      });
    }
  }

  // 5) Municípios sem visita há 7+ dias --------------------------------------
  {
    const muniWithCadastros = new Set<string>();
    for (const s of input.supporters) if (s.municipality_code) muniWithCadastros.add(s.municipality_code);
    for (const v of input.voters) if (v.municipality_code) muniWithCadastros.add(v.municipality_code);

    const recentMuniSet = new Set<string>();
    for (const i of input.interviews) {
      if (i.municipality_code && within(i.created_at, 7, 0)) {
        recentMuniSet.add(i.municipality_code);
      }
    }
    const abandoned = [...muniWithCadastros].filter((code) => !recentMuniSet.has(code));
    if (abandoned.length === 0) {
      out.push({
        id: 'unvisited',
        level: 'good',
        title: 'Todos os municípios visitados esta semana',
        description: 'Cobertura de campo no padrão.',
      });
    } else if (abandoned.length <= 3) {
      out.push({
        id: 'unvisited',
        level: 'warn',
        title: `${abandoned.length} municípios sem visita há 7+ dias`,
        description: 'Programe agente de campo para essas regiões.',
        cta: { label: 'Ver no mapa', to: '/mapa' },
      });
    } else {
      out.push({
        id: 'unvisited',
        level: 'critical',
        title: `${abandoned.length} municípios abandonados`,
        description: 'Redistribua a equipe imediatamente.',
        cta: { label: 'Ver no mapa', to: '/mapa' },
      });
    }
  }

  // 6) Meta de votos ----------------------------------------------------------
  {
    if (input.voteTarget > 0) {
      const progress = scoreTargetProgress(input.supporters, input.voters, input.voteTarget);
      if (progress >= 80) {
        out.push({
          id: 'goal',
          level: 'good',
          title: `Meta ${Math.round(progress)}% atingida`,
          description: 'No caminho certo — manter o ritmo até a eleição.',
        });
      } else if (progress >= 50) {
        out.push({
          id: 'goal',
          level: 'warn',
          title: `${Math.round(progress)}% da meta`,
          description: 'Intensificar conversões nas próximas semanas.',
        });
      } else {
        out.push({
          id: 'goal',
          level: 'critical',
          title: `${Math.round(progress)}% da meta`,
          description: 'Abaixo do mínimo viável — revisar estratégia urgente.',
        });
      }
    }
  }

  // Ordenação: urgent > critical > warn > good
  const order: Record<SignalLevel, number> = { urgent: 0, critical: 1, warn: 2, good: 3 };
  out.sort((a, b) => order[a.level] - order[b.level]);
  return out;
}

function aggregateRegionStrength(
  supporters: Supporter[],
  voters: Voter[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const s of supporters) {
    const r = regionOf(s.municipality_code);
    if (!r) continue;
    const w = s.role === 'lider' ? 35 : s.role === 'cabo' ? 12 : s.role === 'militante' ? 5 : 2;
    totals[r] = (totals[r] ?? 0) + w;
  }
  for (const v of voters) {
    const r = regionOf(v.municipality_code);
    if (!r) continue;
    if (v.vote_intention === 'apoiador') totals[r] = (totals[r] ?? 0) + 1;
    else if (v.vote_intention === 'tendencia_apoio') totals[r] = (totals[r] ?? 0) + 0.6;
  }
  // Normaliza para 0-100 (heurística: top 1 = 100)
  const maxVal = Math.max(1, ...Object.values(totals));
  const normalized: Record<string, number> = {};
  for (const [k, v] of Object.entries(totals)) {
    normalized[k] = (v / maxVal) * 100;
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Radar — 6 eixos atual vs anterior
// ---------------------------------------------------------------------------

export function computeRadar(input: PulseInput): RadarPoint[] {
  const currGrowth = scoreGrowth(input.supporters, input.voters, 7, 0);
  const prevGrowth = scoreGrowth(input.supporters, input.voters, 14, 7);
  const coverage = scoreCoverage(input.supporters, input.voters);
  const currEng = scoreEngagement(input.mentions, 7, 0);
  const prevEng = scoreEngagement(input.mentions, 14, 7);
  const currField = scoreFieldActivity(input.interviews, input.members, 7, 0);
  const prevField = scoreFieldActivity(input.interviews, input.members, 14, 7);
  const currSent = scoreSentiment(input.mentions, 7, 0);
  const prevSent = scoreSentiment(input.mentions, 14, 7);
  const target = scoreTargetProgress(input.supporters, input.voters, input.voteTarget);

  return [
    { axis: 'Base de apoio', current: currGrowth, previous: prevGrowth },
    { axis: 'Cobertura', current: coverage, previous: coverage },
    { axis: 'Engajamento', current: currEng, previous: prevEng },
    { axis: 'Campo', current: currField, previous: prevField },
    { axis: 'Reputação', current: currSent, previous: prevSent },
    { axis: 'Meta', current: target, previous: target },
  ];
}

function scoreEngagement(mentions: Mention[], fromDays: number, toDays: number): number {
  const recent = mentions.filter((m) => within(m.published_at, fromDays, toDays));
  // benchmark: 50 menções/semana = 100
  return clamp((recent.length / 50) * 100);
}
