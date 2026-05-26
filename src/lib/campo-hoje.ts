// Cálculos do painel "Campo Hoje" — sentimento, temas, ranking e visitas.

import type { FieldInterview, VoteIntention } from '@/types';
import { MUNI_COORDS } from '@/data/municipalities-mg-coords';

export type Period = 'today' | 'last3' | 'week';

export const PERIOD_LABEL: Record<Period, string> = {
  today: 'Hoje',
  last3: 'Últimos 3 dias',
  week: 'Esta semana',
};

const MS_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function periodStartIso(period: Period): string {
  const now = startOfDay(new Date());
  const days = period === 'today' ? 0 : period === 'last3' ? 2 : 6;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const today = startOfDay(new Date());
  return d >= today;
}

export function isYesterday(iso: string): boolean {
  const d = new Date(iso);
  const today = startOfDay(new Date());
  const yesterday = new Date(today.getTime() - MS_DAY);
  return d >= yesterday && d < today;
}

export function filterByPeriod(
  interviews: FieldInterview[],
  period: Period,
): FieldInterview[] {
  const startIso = periodStartIso(period);
  return interviews.filter((i) => i.created_at >= startIso);
}

// ---------------------------------------------------------------------------
// Sentimento
// ---------------------------------------------------------------------------

export interface SentimentBucket {
  intention: VoteIntention;
  label: string;
  color: string;
  count: number;
  pct: number; // 0..100
  delta: number; // diferença em pontos percentuais vs ontem
}

export interface SentimentData {
  buckets: SentimentBucket[];
  total: number;
  yesterdayTotal: number;
  favorDeltaPP: number; // soma (apoiador + tendencia_apoio) hoje vs ontem
  trend: 'up' | 'down' | 'stable';
}

const INTENTION_META: Record<
  VoteIntention,
  { label: string; color: string }
> = {
  apoiador: { label: 'A favor', color: '#A3E635' },
  tendencia_apoio: { label: 'Tendência a favor', color: '#65A30D' },
  indeciso: { label: 'Neutro / indeciso', color: '#94A3B8' },
  tendencia_oposicao: { label: 'Tendência contra', color: '#F97316' },
  oposicao: { label: 'Contra', color: '#EF4444' },
};

function countByIntention(items: FieldInterview[]): Record<VoteIntention, number> {
  const counts: Record<VoteIntention, number> = {
    apoiador: 0,
    tendencia_apoio: 0,
    indeciso: 0,
    tendencia_oposicao: 0,
    oposicao: 0,
  };
  for (const it of items) counts[it.vote_intention] += 1;
  return counts;
}

export function computeSentiment(interviews: FieldInterview[]): SentimentData {
  const todayItems = interviews.filter((i) => isToday(i.created_at));
  const ydayItems = interviews.filter((i) => isYesterday(i.created_at));

  const todayCounts = countByIntention(todayItems);
  const ydayCounts = countByIntention(ydayItems);

  const total = todayItems.length;
  const ydayTotal = ydayItems.length;

  function pct(n: number, denom: number): number {
    return denom === 0 ? 0 : (n / denom) * 100;
  }

  const intentions: VoteIntention[] = [
    'apoiador',
    'tendencia_apoio',
    'indeciso',
    'tendencia_oposicao',
    'oposicao',
  ];
  const buckets: SentimentBucket[] = intentions.map((intention) => ({
    intention,
    label: INTENTION_META[intention].label,
    color: INTENTION_META[intention].color,
    count: todayCounts[intention],
    pct: pct(todayCounts[intention], total),
    delta: pct(todayCounts[intention], total) - pct(ydayCounts[intention], ydayTotal),
  }));

  const favorToday = pct(todayCounts.apoiador + todayCounts.tendencia_apoio, total);
  const favorYday = pct(ydayCounts.apoiador + ydayCounts.tendencia_apoio, ydayTotal);
  const favorDeltaPP = favorToday - favorYday;
  const trend: 'up' | 'down' | 'stable' =
    Math.abs(favorDeltaPP) < 2 ? 'stable' : favorDeltaPP > 0 ? 'up' : 'down';

  return {
    buckets,
    total,
    yesterdayTotal: ydayTotal,
    favorDeltaPP,
    trend,
  };
}

// ---------------------------------------------------------------------------
// Temas mais citados + Decisão sugerida
// ---------------------------------------------------------------------------

export interface ThemeRow {
  theme: string;
  count: number;
  pct: number;
}

// Mapa flexível: faz match parcial pelo nome do tema (case-insensitive).
const DECISION_MAP: Array<{ match: RegExp; suggestion: string }> = [
  {
    match: /sa[úu]de/i,
    suggestion: 'Considere visitar UBS ou hospital amanhã na agenda. Leve liderança da área.',
  },
  {
    match: /seguran[çc]a/i,
    suggestion: 'Agende reunião com lideranças de segurança comunitária e comércio local.',
  },
  {
    match: /emprego|renda/i,
    suggestion: 'Visite comércio local ou pequenas empresas da região com material de qualificação.',
  },
  {
    match: /infraestrutura|asfalto|estrada|transporte/i,
    suggestion: 'Faça visita à rua ou rodovia problemática com câmera. Registre antes/depois.',
  },
  {
    match: /educa[çc][ãa]o/i,
    suggestion: 'Visite escola estadual da região amanhã cedo. Encontre pais e professores na saída.',
  },
  {
    match: /saneamento|esgoto|[áa]gua/i,
    suggestion: 'Fotografe pontos de esgoto a céu aberto com liderança local. Documente para a imprensa.',
  },
  {
    match: /habita[çc][ãa]o|moradia/i,
    suggestion: 'Visite ocupações ou bairros com déficit habitacional reconhecido.',
  },
  {
    match: /corrup[çc][ãa]o/i,
    suggestion: 'Reforce postura de transparência: publique agenda e patrimônio nas redes amanhã.',
  },
  {
    match: /meio ambiente/i,
    suggestion: 'Faça visita a APA ou área degradada com plantio simbólico. Convide imprensa local.',
  },
  {
    match: /assist[êe]ncia/i,
    suggestion: 'Visite CRAS/CREAS amanhã e converse com beneficiários.',
  },
  {
    match: /agro/i,
    suggestion: 'Reunião com cooperativa local ou produtor rural com pauta de crédito agrícola.',
  },
];

export function findSuggestionFor(theme: string | undefined | null): string | null {
  if (!theme) return null;
  const found = DECISION_MAP.find((d) => d.match.test(theme));
  return found?.suggestion ?? null;
}

export function computeThemes(interviews: FieldInterview[], top = 5): ThemeRow[] {
  const items = interviews.filter((i) => isToday(i.created_at));
  const counts = new Map<string, number>();
  let totalMentions = 0;
  for (const it of items) {
    for (const t of it.priority_themes ?? []) {
      const key = t.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      totalMentions += 1;
    }
  }
  return [...counts.entries()]
    .map(([theme, count]) => ({
      theme,
      count,
      pct: totalMentions === 0 ? 0 : (count / totalMentions) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}

// ---------------------------------------------------------------------------
// Ranking de equipe
// ---------------------------------------------------------------------------

export interface AgentRankRow {
  user_id: string;
  count: number;
  lastNeighborhood: string | null;
  lastMunicipalityCode: string | null;
  lastMunicipalityName: string | null;
  lastAt: string;
}

export function computeAgentRanking(
  interviews: FieldInterview[],
  top = 5,
): AgentRankRow[] {
  const items = interviews.filter((i) => isToday(i.created_at));
  const byAgent = new Map<string, FieldInterview[]>();
  for (const it of items) {
    const arr = byAgent.get(it.created_by) ?? [];
    arr.push(it);
    byAgent.set(it.created_by, arr);
  }
  const rows: AgentRankRow[] = [];
  for (const [user_id, list] of byAgent) {
    const sorted = list
      .slice()
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    const latest = sorted[0];
    const muniName = latest.municipality_code
      ? MUNI_COORDS[latest.municipality_code]?.name ?? null
      : null;
    rows.push({
      user_id,
      count: list.length,
      lastNeighborhood: latest.neighborhood ?? null,
      lastMunicipalityCode: latest.municipality_code ?? null,
      lastMunicipalityName: muniName,
      lastAt: latest.created_at,
    });
  }
  return rows.sort((a, b) => b.count - a.count).slice(0, top);
}

// ---------------------------------------------------------------------------
// Visitas do mapa — agrupamento por bairro quando > N no mesmo
// ---------------------------------------------------------------------------

export interface VisitMarker {
  id: string;
  lat: number;
  lng: number;
  intention: VoteIntention;
  voterName: string;
  neighborhood: string | null;
  createdAt: string;
}

export interface VisitCluster {
  key: string;
  lat: number;
  lng: number;
  count: number;
  neighborhood: string;
  intentionsBreakdown: Record<VoteIntention, number>;
}

export interface VisitsBreakdown {
  markers: VisitMarker[]; // pontos individuais
  clusters: VisitCluster[]; // grupos com > 3 no mesmo bairro
  neighborhoodsWithoutGps: string[]; // entrevistas sem lat/lng
}

export function buildVisitsBreakdown(interviews: FieldInterview[]): VisitsBreakdown {
  const withGps = interviews.filter(
    (i): i is FieldInterview & { lat: number; lng: number } =>
      i.lat != null && i.lng != null,
  );
  const withoutGps = interviews.filter((i) => i.lat == null || i.lng == null);

  // Agrupa por bairro (case insensitive, trim)
  const byHood = new Map<
    string,
    { items: typeof withGps; neighborhood: string }
  >();
  for (const it of withGps) {
    const h = (it.neighborhood ?? '').trim();
    if (!h) continue;
    const key = h.toLowerCase();
    const slot = byHood.get(key) ?? { items: [], neighborhood: h };
    slot.items.push(it);
    byHood.set(key, slot);
  }

  const clustered = new Set<string>(); // ids agrupados
  const clusters: VisitCluster[] = [];
  for (const [key, { items, neighborhood }] of byHood) {
    if (items.length < 4) continue;
    // Centroide
    const lat = items.reduce((acc, x) => acc + x.lat, 0) / items.length;
    const lng = items.reduce((acc, x) => acc + x.lng, 0) / items.length;
    const breakdown: Record<VoteIntention, number> = {
      apoiador: 0,
      tendencia_apoio: 0,
      indeciso: 0,
      tendencia_oposicao: 0,
      oposicao: 0,
    };
    for (const it of items) {
      breakdown[it.vote_intention] += 1;
      clustered.add(it.id);
    }
    clusters.push({
      key,
      lat,
      lng,
      count: items.length,
      neighborhood,
      intentionsBreakdown: breakdown,
    });
  }

  const markers: VisitMarker[] = withGps
    .filter((it) => !clustered.has(it.id))
    .map((it) => ({
      id: it.id,
      lat: it.lat,
      lng: it.lng,
      intention: it.vote_intention,
      voterName: it.voter_name,
      neighborhood: it.neighborhood,
      createdAt: it.created_at,
    }));

  const neighborhoodsWithoutGps = [
    ...new Set(
      withoutGps
        .map((i) => i.neighborhood?.trim())
        .filter((x): x is string => !!x),
    ),
  ];

  return { markers, clusters, neighborhoodsWithoutGps };
}

export const INTENTION_COLOR: Record<VoteIntention, string> = {
  apoiador: '#A3E635',
  tendencia_apoio: '#65A30D',
  indeciso: '#F59E0B',
  tendencia_oposicao: '#F97316',
  oposicao: '#EF4444',
};
