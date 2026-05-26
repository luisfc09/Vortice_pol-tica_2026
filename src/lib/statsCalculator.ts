// Estatísticas locais para o módulo de Inteligência Eleitoral.
//
// TUDO aqui é puro: recebe FieldInterview[], devolve estruturas
// agregadas. Sem dependência de Supabase ou React. Reusável por
// frontend (fallback computado) e backend (edge function).

import {
  AGE_RANGE_LABEL,
  CITY_PROBLEM_LABEL,
  EDUCATION_LABEL,
  GENDER_LABEL,
  GOV_RATING_LABEL,
  INCOME_LABEL,
  RELIGION_LABEL,
  VOTE_INTENTION_LABEL,
  type CrossTab,
  type CrossTabRow,
  type DistributionItem,
  type FieldInterview,
  type GovRating,
  type GovRatings,
  type SentimentByTheme,
  type ThemeRow,
} from '@/types';
import { MUNI_COORDS } from '@/data/municipalities-mg-coords';

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

function safeStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function pct(num: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((num / denom) * 1000) / 10;
}

// Conta ocorrências de uma chave numa lista (ignora null/undefined).
function tally<T>(items: T[], keyOf: (x: T) => string | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = keyOf(it);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function toDistribution(
  m: Map<string, number>,
  total: number,
  labelOf?: (key: string) => string,
): DistributionItem[] {
  return [...m.entries()]
    .map(([k, count]) => ({
      label: labelOf ? labelOf(k) : k,
      count,
      pct: pct(count, total),
    }))
    .sort((a, b) => b.count - a.count);
}

// Tabela cruzada: row × col → count.
// Devolve por linha o total e células ordenadas por % desc.
function crossTab<T>(
  items: T[],
  rowOf: (x: T) => string | null,
  colOf: (x: T) => string | null,
  labelRow?: (k: string) => string,
  labelCol?: (k: string) => string,
): CrossTab {
  const matrix = new Map<string, Map<string, number>>();
  for (const it of items) {
    const r = rowOf(it);
    const c = colOf(it);
    if (!r || !c) continue;
    if (!matrix.has(r)) matrix.set(r, new Map());
    const row = matrix.get(r)!;
    row.set(c, (row.get(c) ?? 0) + 1);
  }
  const rows: CrossTabRow[] = [];
  for (const [r, row] of matrix.entries()) {
    let total = 0;
    for (const v of row.values()) total += v;
    const cells = [...row.entries()]
      .map(([c, count]) => ({
        colKey: labelCol ? labelCol(c) : c,
        count,
        pct: pct(count, total),
      }))
      .sort((a, b) => b.pct - a.pct);
    rows.push({
      rowKey: labelRow ? labelRow(r) : r,
      total,
      cells,
    });
  }
  // Ordena linhas por total desc
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

// ---------------------------------------------------------------------------
// Distribuições
// ---------------------------------------------------------------------------

export function distVoteIntention(items: FieldInterview[]): DistributionItem[] {
  const m = tally(items, (i) => i.vote_intention);
  return toDistribution(m, items.length, (k) => VOTE_INTENTION_LABEL[k as keyof typeof VOTE_INTENTION_LABEL] ?? k);
}

export function distAge(items: FieldInterview[]): DistributionItem[] {
  const filtered = items.filter((i) => i.age_range);
  const m = tally(filtered, (i) => i.age_range);
  return toDistribution(m, filtered.length, (k) => AGE_RANGE_LABEL[k as keyof typeof AGE_RANGE_LABEL] ?? k);
}

export function distGender(items: FieldInterview[]): DistributionItem[] {
  const filtered = items.filter((i) => i.gender);
  const m = tally(filtered, (i) => i.gender);
  return toDistribution(m, filtered.length, (k) => GENDER_LABEL[k as keyof typeof GENDER_LABEL] ?? k);
}

export function distReligion(items: FieldInterview[]): DistributionItem[] {
  const filtered = items.filter((i) => i.religion);
  const m = tally(filtered, (i) => i.religion);
  return toDistribution(m, filtered.length, (k) => RELIGION_LABEL[k as keyof typeof RELIGION_LABEL] ?? k);
}

export function distIncome(items: FieldInterview[]): DistributionItem[] {
  const filtered = items.filter((i) => i.income_range);
  const m = tally(filtered, (i) => i.income_range);
  return toDistribution(m, filtered.length, (k) => INCOME_LABEL[k as keyof typeof INCOME_LABEL] ?? k);
}

export function distEducation(items: FieldInterview[]): DistributionItem[] {
  const filtered = items.filter((i) => i.education);
  const m = tally(filtered, (i) => i.education);
  return toDistribution(m, filtered.length, (k) => EDUCATION_LABEL[k as keyof typeof EDUCATION_LABEL] ?? k);
}

// ---------------------------------------------------------------------------
// Cruzamentos
// ---------------------------------------------------------------------------

const labelVote = (k: string) => VOTE_INTENTION_LABEL[k as keyof typeof VOTE_INTENTION_LABEL] ?? k;

export function intentionByAge(items: FieldInterview[]): CrossTab {
  return crossTab(
    items,
    (i) => i.age_range,
    (i) => i.vote_intention,
    (k) => AGE_RANGE_LABEL[k as keyof typeof AGE_RANGE_LABEL] ?? k,
    labelVote,
  );
}
export function intentionByReligion(items: FieldInterview[]): CrossTab {
  return crossTab(
    items,
    (i) => i.religion,
    (i) => i.vote_intention,
    (k) => RELIGION_LABEL[k as keyof typeof RELIGION_LABEL] ?? k,
    labelVote,
  );
}
export function intentionByIncome(items: FieldInterview[]): CrossTab {
  return crossTab(
    items,
    (i) => i.income_range,
    (i) => i.vote_intention,
    (k) => INCOME_LABEL[k as keyof typeof INCOME_LABEL] ?? k,
    labelVote,
  );
}
export function intentionByGender(items: FieldInterview[]): CrossTab {
  return crossTab(
    items,
    (i) => i.gender,
    (i) => i.vote_intention,
    (k) => GENDER_LABEL[k as keyof typeof GENDER_LABEL] ?? k,
    labelVote,
  );
}
export function intentionByMunicipality(items: FieldInterview[]): CrossTab {
  return crossTab(
    items,
    (i) => i.municipality_code,
    (i) => i.vote_intention,
    (k) => MUNI_COORDS[k]?.name ?? k,
    labelVote,
  );
}

// ---------------------------------------------------------------------------
// Temas
// ---------------------------------------------------------------------------

export function themesRanking(items: FieldInterview[]): ThemeRow[] {
  const m = new Map<string, number>();
  for (const i of items) {
    for (const t of i.priority_themes ?? []) {
      m.set(t, (m.get(t) ?? 0) + 1);
    }
  }
  const total = items.length;
  return [...m.entries()]
    .map(([theme, count]) => ({ theme, count, pct: pct(count, total) }))
    .sort((a, b) => b.count - a.count);
}

// Cruza temas (cada item da lista) × intenção de voto. Pra cada tema,
// distribui os apoiadores/indecisos/contra.
export function themesByIntention(items: FieldInterview[]): CrossTab {
  // Expandir: cada (entrevista × tema) vira uma linha lógica
  const expanded: { theme: string; intention: string }[] = [];
  for (const i of items) {
    for (const t of i.priority_themes ?? []) {
      expanded.push({ theme: t, intention: i.vote_intention });
    }
  }
  return crossTab(
    expanded,
    (x) => x.theme,
    (x) => x.intention,
    undefined,
    labelVote,
  );
}

export function themesByRegion(items: FieldInterview[]): Record<string, ThemeRow[]> {
  const byMuni = new Map<string, FieldInterview[]>();
  for (const i of items) {
    if (!i.municipality_code) continue;
    if (!byMuni.has(i.municipality_code)) byMuni.set(i.municipality_code, []);
    byMuni.get(i.municipality_code)!.push(i);
  }
  const out: Record<string, ThemeRow[]> = {};
  for (const [code, list] of byMuni.entries()) {
    const name = MUNI_COORDS[code]?.name ?? code;
    out[name] = themesRanking(list);
  }
  return out;
}

export function themesByProfile(items: FieldInterview[]): Record<string, ThemeRow[]> {
  const segments: Record<string, FieldInterview[]> = {
    'Jovens 16-24': items.filter((i) => i.age_range === '16-24'),
    'Mulheres 35-44': items.filter((i) => i.age_range === '35-44' && i.gender === 'feminino'),
    'Evangélicos': items.filter((i) => i.religion === 'evangelico'),
    'Baixa renda (até 3SM)': items.filter(
      (i) => i.income_range === 'ate_1sm' || i.income_range === '1_3sm',
    ),
    'Indecisos': items.filter(
      (i) => i.vote_intention === 'indeciso' || i.vote_intention === 'tendencia_apoio',
    ),
  };
  const out: Record<string, ThemeRow[]> = {};
  for (const [name, list] of Object.entries(segments)) {
    if (list.length > 0) out[name] = themesRanking(list).slice(0, 5);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Governo
// ---------------------------------------------------------------------------

const GOV_RATING_NUMERIC: Record<GovRating, number> = {
  pessimo: 1,
  ruim: 2,
  regular: 3,
  bom: 4,
  otimo: 5,
};

function avgGov(items: FieldInterview[], key: 'state_gov_rating' | 'federal_gov_rating' | 'city_gov_rating'): number | null {
  let sum = 0;
  let n = 0;
  for (const i of items) {
    const v = i[key] as GovRating | null;
    if (v && v in GOV_RATING_NUMERIC) {
      sum += GOV_RATING_NUMERIC[v];
      n += 1;
    }
  }
  if (!n) return null;
  return Math.round((sum / n) * 10) / 10;
}

export function govRatings(items: FieldInterview[]): GovRatings {
  return {
    state: avgGov(items, 'state_gov_rating'),
    federal: avgGov(items, 'federal_gov_rating'),
    city: avgGov(items, 'city_gov_rating'),
  };
}

// ---------------------------------------------------------------------------
// Sentimento por tema (heurística simples baseada em opinião do candidato).
// Cada entrevista contribui pro sentimento dos temas que ela citou.
// ---------------------------------------------------------------------------

export function sentimentByTheme(items: FieldInterview[]): SentimentByTheme {
  const out: SentimentByTheme = {};
  for (const i of items) {
    const themes = i.priority_themes ?? [];
    if (themes.length === 0) continue;
    const op = i.candidate_opinion;
    let bucket: 'positivo' | 'neutro' | 'negativo' = 'neutro';
    if (op === 'muito_positiva' || op === 'positiva') bucket = 'positivo';
    else if (op === 'muito_negativa' || op === 'negativa') bucket = 'negativo';
    for (const t of themes) {
      if (!out[t]) out[t] = { positivo: 0, neutro: 0, negativo: 0 };
      out[t][bucket] += 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Segmento de indecisos (oportunidade)
// ---------------------------------------------------------------------------

export function indecisosBreakdown(items: FieldInterview[]) {
  const indecisos = items.filter(
    (i) => i.vote_intention === 'indeciso' || i.vote_intention === 'tendencia_apoio',
  );
  const total = indecisos.length;
  if (total === 0) {
    return {
      total: 0,
      pct: 0,
      by_age: [],
      by_religion: [],
      by_income: [],
      themes: [],
      top_conversion_argument: null as string | null,
    };
  }
  return {
    total,
    pct: pct(total, items.length),
    by_age: distAge(indecisos),
    by_religion: distReligion(indecisos),
    by_income: distIncome(indecisos),
    themes: themesRanking(indecisos).slice(0, 5),
    top_conversion_argument: mostCommonText(indecisos.map((i) => i.conversion_argument)),
  };
}

function mostCommonText(values: (string | null)[]): string | null {
  const m = new Map<string, number>();
  for (const v of values) {
    const s = safeStr(v)?.toLowerCase();
    if (!s) continue;
    m.set(s, (m.get(s) ?? 0) + 1);
  }
  let best: { k: string; n: number } | null = null;
  for (const [k, n] of m.entries()) {
    if (!best || n > best.n) best = { k, n };
  }
  return best?.k ?? null;
}

// ---------------------------------------------------------------------------
// Resumo agregado pra IA. Útil pra mandar pro Claude um JSON denso
// e pra usar como fallback quando não há análise da IA salva.
// ---------------------------------------------------------------------------

export interface ComputedStats {
  total: number;
  vote_intention_dist: DistributionItem[];
  age_dist: DistributionItem[];
  gender_dist: DistributionItem[];
  religion_dist: DistributionItem[];
  income_dist: DistributionItem[];
  education_dist: DistributionItem[];
  crossings: {
    intention_by_age: CrossTab;
    intention_by_religion: CrossTab;
    intention_by_income: CrossTab;
    intention_by_gender: CrossTab;
    intention_by_municipality: CrossTab;
    themes_by_intention: CrossTab;
  };
  themes_ranking: ThemeRow[];
  themes_by_region: Record<string, ThemeRow[]>;
  themes_by_profile: Record<string, ThemeRow[]>;
  gov_ratings: GovRatings;
  sentiment_analysis: SentimentByTheme;
  segments_to_convert: ReturnType<typeof indecisosBreakdown>;
}

export function calculateStats(items: FieldInterview[]): ComputedStats {
  return {
    total: items.length,
    vote_intention_dist: distVoteIntention(items),
    age_dist: distAge(items),
    gender_dist: distGender(items),
    religion_dist: distReligion(items),
    income_dist: distIncome(items),
    education_dist: distEducation(items),
    crossings: {
      intention_by_age: intentionByAge(items),
      intention_by_religion: intentionByReligion(items),
      intention_by_income: intentionByIncome(items),
      intention_by_gender: intentionByGender(items),
      intention_by_municipality: intentionByMunicipality(items),
      themes_by_intention: themesByIntention(items),
    },
    themes_ranking: themesRanking(items),
    themes_by_region: themesByRegion(items),
    themes_by_profile: themesByProfile(items),
    gov_ratings: govRatings(items),
    sentiment_analysis: sentimentByTheme(items),
    segments_to_convert: indecisosBreakdown(items),
  };
}

// Labels úteis pros componentes
export const PROBLEM_LABEL_HELPER = CITY_PROBLEM_LABEL;
export const GOV_LABEL_HELPER = GOV_RATING_LABEL;
