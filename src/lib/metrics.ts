import type {
  CampaignEvent,
  EventType,
  FieldInterview,
  Mention,
  Supporter,
  Voter,
} from '@/types';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';
import { MUNI_COORDS } from '@/data/municipalities-mg-coords';
import { MG_REGIONS, regionOf, type MgRegion } from '@/data/regions-mg';

const APPROX_MG_POPULATION = 21_000_000;
const TOTAL_MG_MUNICIPALITIES = 853; // IBGE
const TOTAL_REGIONS = 6;

export interface DashboardMetrics {
  totalSupporters: number;
  totalVoters: number;
  totalSupportersApoiadores: number;
  municipalitiesCovered: number;
  regionsCovered: number;
  estimatedVotes: number;
  voteTarget: number;
  targetProgress: number;
  positiveRate: number;
  negativeRate: number;
}

function isWithinDays(iso: string, days: number): boolean {
  const ms = Date.now() - +new Date(iso);
  return ms >= 0 && ms <= days * 86_400_000;
}

export function computeMetrics(
  supporters: Supporter[],
  voters: Voter[],
  mentions: Mention[],
  voteTarget: number,
): DashboardMetrics {
  const muniSet = new Set<string>();
  for (const s of supporters) if (s.municipality_code) muniSet.add(s.municipality_code);
  for (const v of voters) if (v.municipality_code) muniSet.add(v.municipality_code);

  const regionSet = new Set<MgRegion>();
  for (const code of muniSet) {
    const r = regionOf(code);
    if (r) regionSet.add(r);
  }

  const apoiadoresFromVoters = voters.filter((v) => v.vote_intention === 'apoiador').length;
  const tendApoio = voters.filter((v) => v.vote_intention === 'tendencia_apoio').length;
  const totalSupportersApoiadores =
    supporters.filter((s) => s.role === 'apoiador').length + apoiadoresFromVoters;

  // Estimativa
  let estimate = 0;
  for (const s of supporters) {
    if (s.role === 'lider') estimate += 35;
    else if (s.role === 'cabo') estimate += 12;
    else if (s.role === 'militante') estimate += 5;
    else estimate += 2;
  }
  estimate += apoiadoresFromVoters * 1 + tendApoio * 0.6;
  estimate = Math.round(estimate);

  const total = mentions.length || 1;
  const positive = mentions.filter((m) => m.sentiment === 'positivo').length;
  const negative = mentions.filter((m) => m.sentiment === 'negativo').length;

  return {
    totalSupporters: supporters.length,
    totalVoters: voters.length,
    totalSupportersApoiadores,
    municipalitiesCovered: muniSet.size,
    regionsCovered: regionSet.size,
    estimatedVotes: estimate,
    voteTarget,
    targetProgress: voteTarget > 0 ? Math.min(1, estimate / voteTarget) : 0,
    positiveRate: positive / total,
    negativeRate: negative / total,
  };
}

export function totalMunicipalitiesMG(): number {
  return TOTAL_MG_MUNICIPALITIES;
}

export function totalRegionsMG(): number {
  return TOTAL_REGIONS;
}

export function knownMunicipalitiesMG(): number {
  return MG_MUNICIPALITIES.length;
}

export function totalMGPopulation(): number {
  return APPROX_MG_POPULATION;
}

// Crescimento percentual entre últimos 7d e os 7d anteriores.
export function weeklyDelta(items: { created_at: string }[]): {
  thisWeek: number;
  pct: number;
} {
  const now = Date.now();
  const sevenDays = 7 * 86_400_000;
  let thisWeek = 0;
  let lastWeek = 0;
  for (const it of items) {
    const t = +new Date(it.created_at);
    const diff = now - t;
    if (diff < 0) continue;
    if (diff <= sevenDays) thisWeek += 1;
    else if (diff <= sevenDays * 2) lastWeek += 1;
  }
  const pct = lastWeek > 0 ? (thisWeek - lastWeek) / lastWeek : thisWeek > 0 ? 1 : 0;
  return { thisWeek, pct };
}

interface RegistrationPoint {
  date: string;
  supporters: number;
  voters: number;
}

export function buildRegistrationTimeline(
  supporters: Supporter[],
  voters: Voter[],
  days: 7 | 30 = 7,
): RegistrationPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const labels: { key: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label =
      days === 7
        ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    labels.push({ key, label });
  }

  function countOn(day: string, items: { created_at: string }[]): number {
    return items.filter((x) => x.created_at.slice(0, 10) <= day).length;
  }

  return labels.map(({ key, label }) => ({
    date: label,
    supporters: countOn(key, supporters),
    voters: countOn(key, voters),
  }));
}

// --- Regiões -----------------------------------------------------------------
export interface RegionStat {
  region: MgRegion;
  estimate: number;
  target: number;
}

export function buildRegionStats(
  supporters: Supporter[],
  voters: Voter[],
  voteTarget: number,
): RegionStat[] {
  // Pesos iguais aos do cálculo total
  const totals: Record<MgRegion, number> = {
    Norte: 0,
    Triângulo: 0,
    Central: 0,
    'Zona da Mata': 0,
    Sul: 0,
    Oeste: 0,
  };

  for (const s of supporters) {
    const r = regionOf(s.municipality_code);
    if (!r) continue;
    const w = s.role === 'lider' ? 35 : s.role === 'cabo' ? 12 : s.role === 'militante' ? 5 : 2;
    totals[r] += w;
  }
  for (const v of voters) {
    const r = regionOf(v.municipality_code);
    if (!r) continue;
    if (v.vote_intention === 'apoiador') totals[r] += 1;
    else if (v.vote_intention === 'tendencia_apoio') totals[r] += 0.6;
  }

  // Meta por região: distribuição aproximada de eleitorado em MG
  const TARGET_WEIGHT: Record<MgRegion, number> = {
    Central: 0.34,
    Norte: 0.13,
    Triângulo: 0.18,
    'Zona da Mata': 0.13,
    Sul: 0.16,
    Oeste: 0.06,
  };

  return MG_REGIONS.map((region) => ({
    region,
    estimate: Math.round(totals[region]),
    target: Math.round((voteTarget || 0) * TARGET_WEIGHT[region]),
  }));
}

// --- Ranking de cidades ------------------------------------------------------
export interface CityRankRow {
  code: string;
  name: string;
  supporters: number;
  voters: number;
  score: number;
}

export function buildCityRanking(
  supporters: Supporter[],
  voters: Voter[],
  limit = 5,
): CityRankRow[] {
  const map = new Map<string, CityRankRow>();
  const lookupName = (code: string) =>
    MUNI_COORDS[code]?.name ??
    MG_MUNICIPALITIES.find((m) => m.code === code)?.name ??
    'Município';

  for (const s of supporters) {
    if (!s.municipality_code) continue;
    const code = s.municipality_code;
    const row = map.get(code) ?? {
      code,
      name: lookupName(code),
      supporters: 0,
      voters: 0,
      score: 0,
    };
    row.supporters += 1;
    map.set(code, row);
  }
  for (const v of voters) {
    if (!v.municipality_code) continue;
    const code = v.municipality_code;
    const row = map.get(code) ?? {
      code,
      name: lookupName(code),
      supporters: 0,
      voters: 0,
      score: 0,
    };
    row.voters += 1;
    map.set(code, row);
  }

  for (const row of map.values()) {
    row.score = row.supporters * 8 + row.voters;
  }

  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// --- Engajamento por canal/tipo de evento ------------------------------------
export interface EngagementSlice {
  label: string;
  value: number;
  color: string;
}

export function buildEngagementBreakdown(
  events: CampaignEvent[],
  interviews: FieldInterview[],
): EngagementSlice[] {
  const byType: Record<EventType, number> = {
    comicio: 0,
    reuniao: 0,
    visita: 0,
    midia: 0,
    outro: 0,
  };
  for (const e of events) byType[e.type] += 1;

  // Entrevistas de campo são consideradas "Conversas diretas"
  const interviewsCount = interviews.length;

  const total =
    byType.comicio +
    byType.reuniao +
    byType.visita +
    byType.midia +
    byType.outro +
    interviewsCount;

  const slices: EngagementSlice[] = [
    { label: 'Reuniões', value: byType.reuniao, color: '#A78BFA' },
    { label: 'Comícios', value: byType.comicio, color: '#A3E635' },
    { label: 'Visitas', value: byType.visita, color: '#34D399' },
    { label: 'Mídia', value: byType.midia, color: '#F59E0B' },
    { label: 'Conversas', value: interviewsCount, color: '#60A5FA' },
    { label: 'Outros', value: byType.outro, color: '#94A3B8' },
  ].filter((s) => s.value > 0);

  if (total === 0) {
    // sem dados: mostra placeholder
    return [{ label: 'Sem atividade ainda', value: 1, color: '#1A2540' }];
  }
  return slices;
}

// --- Mini KPIs do rodapé -----------------------------------------------------
export interface MiniKpiData {
  meetings: { value: number; trendPct: number };
  visits: { value: number; trendPct: number };
  events: { value: number; trendPct: number };
  interviews: { value: number; trendPct: number };
}

export function buildMiniKpis(
  events: CampaignEvent[],
  interviews: FieldInterview[],
): MiniKpiData {
  const meetingsThisWeek = events.filter(
    (e) => e.type === 'reuniao' && isWithinDays(e.created_at, 7),
  );
  const meetingsLastWeek = events.filter(
    (e) => e.type === 'reuniao' && !isWithinDays(e.created_at, 7) && isWithinDays(e.created_at, 14),
  );
  const visitsThisWeek = events.filter(
    (e) => e.type === 'visita' && isWithinDays(e.created_at, 7),
  );
  const visitsLastWeek = events.filter(
    (e) => e.type === 'visita' && !isWithinDays(e.created_at, 7) && isWithinDays(e.created_at, 14),
  );
  const eventsThisWeek = events.filter((e) => isWithinDays(e.created_at, 7));
  const eventsLastWeek = events.filter(
    (e) => !isWithinDays(e.created_at, 7) && isWithinDays(e.created_at, 14),
  );
  const interviewsThisWeek = interviews.filter((i) => isWithinDays(i.created_at, 7));
  const interviewsLastWeek = interviews.filter(
    (i) => !isWithinDays(i.created_at, 7) && isWithinDays(i.created_at, 14),
  );

  function pct(curr: number, prev: number): number {
    if (prev === 0) return curr > 0 ? 1 : 0;
    return (curr - prev) / prev;
  }

  return {
    meetings: { value: meetingsThisWeek.length, trendPct: pct(meetingsThisWeek.length, meetingsLastWeek.length) },
    visits: { value: visitsThisWeek.length, trendPct: pct(visitsThisWeek.length, visitsLastWeek.length) },
    events: { value: eventsThisWeek.length, trendPct: pct(eventsThisWeek.length, eventsLastWeek.length) },
    interviews: { value: interviewsThisWeek.length, trendPct: pct(interviewsThisWeek.length, interviewsLastWeek.length) },
  };
}
