// ============================================================================
// surveyFormStats — estatística de UM formulário de pesquisa (Fase 6).
// Funções puras sobre survey_responses[] + survey_form_questions[]:
//   • amostra (total / presencial / público)
//   • demografia (faixa etária / sexo / religião)
//   • agregação por pergunta (os 5 tipos)
//   • cruzamento pergunta × demografia
// Respostas vêm em survey_responses.answers (jsonb) indexadas por question.id.
// ============================================================================

import {
  AGE_RANGE_LABEL,
  GENDER_LABEL,
  RELIGION_LABEL,
  type AgeRange,
  type CampaignQuestionType,
  type Gender,
  type Religion,
  type SurveyFormQuestion,
  type SurveyResponse,
} from '@/types';

export interface DistItem {
  label: string;
  count: number;
  pct: number;
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
}

// --- Amostra ---------------------------------------------------------------
export interface FormSample {
  total: number;
  presencial: number;
  publico: number;
}

export function sampleOf(responses: SurveyResponse[]): FormSample {
  return {
    total: responses.length,
    presencial: responses.filter((r) => r.channel === 'presencial').length,
    publico: responses.filter((r) => r.channel === 'publico').length,
  };
}

// --- Demografia ------------------------------------------------------------
function distByKey<T extends string>(
  values: (T | null | undefined)[],
  labelOf: (k: T) => string,
): DistItem[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const v of values) {
    if (!v) continue;
    total++;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([k, count]) => ({ label: labelOf(k as T), count, pct: pct(count, total) }))
    .sort((a, b) => b.count - a.count);
}

export interface Demographics {
  age: DistItem[];
  gender: DistItem[];
  religion: DistItem[];
}

export function demographicsOf(responses: SurveyResponse[]): Demographics {
  return {
    age: distByKey<AgeRange>(
      responses.map((r) => r.age_range),
      (k) => AGE_RANGE_LABEL[k] ?? k,
    ),
    gender: distByKey<Gender>(
      responses.map((r) => r.gender),
      (k) => GENDER_LABEL[k] ?? k,
    ),
    religion: distByKey<Religion>(
      responses.map((r) => r.religion),
      (k) => RELIGION_LABEL[k] ?? k,
    ),
  };
}

// --- Agregação por pergunta ------------------------------------------------
export interface QuestionAgg {
  question: SurveyFormQuestion;
  type: CampaignQuestionType;
  distribution: DistItem[]; // vazio pra free_text
  total: number; // nº de respostas com valor
  average?: number; // scale_1_5
  texts?: string[]; // free_text (respostas cruas)
}

function answerOf(r: SurveyResponse, qid: string): unknown {
  return r.answers?.[qid];
}

function isFilled(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function aggregateQuestion(
  question: SurveyFormQuestion,
  responses: SurveyResponse[],
): QuestionAgg {
  const type = question.type;
  const values = responses.map((r) => answerOf(r, question.id)).filter(isFilled);
  const total = values.length;

  if (type === 'free_text') {
    return {
      question,
      type,
      distribution: [],
      total,
      texts: values.map((v) => String(v)),
    };
  }

  if (type === 'scale_1_5') {
    const nums = values.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
    const counts = new Map<string, number>();
    for (const n of nums) counts.set(String(n), (counts.get(String(n)) ?? 0) + 1);
    const distribution: DistItem[] = ['5', '4', '3', '2', '1'].map((k) => ({
      label: k,
      count: counts.get(k) ?? 0,
      pct: pct(counts.get(k) ?? 0, nums.length),
    }));
    const avg = nums.length
      ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10
      : undefined;
    return { question, type, distribution, total: nums.length, average: avg };
  }

  if (type === 'multiple_choice') {
    // % sobre respondentes (cada um pode marcar várias).
    const counts = new Map<string, number>();
    for (const v of values) {
      const arr = Array.isArray(v) ? v : [String(v)];
      for (const opt of arr) counts.set(String(opt), (counts.get(String(opt)) ?? 0) + 1);
    }
    const distribution = [...counts.entries()]
      .map(([label, count]) => ({ label, count, pct: pct(count, total) }))
      .sort((a, b) => b.count - a.count);
    return { question, type, distribution, total };
  }

  // yes_no / single_choice
  const counts = new Map<string, number>();
  for (const v of values) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  let distribution: DistItem[];
  if (type === 'yes_no') {
    distribution = ['Sim', 'Não'].map((label) => ({
      label,
      count: counts.get(label) ?? 0,
      pct: pct(counts.get(label) ?? 0, total),
    }));
  } else {
    distribution = [...counts.entries()]
      .map(([label, count]) => ({ label, count, pct: pct(count, total) }))
      .sort((a, b) => b.count - a.count);
  }
  return { question, type, distribution, total };
}

// --- Cruzamento pergunta × demografia --------------------------------------
export type DemographicKey = 'age' | 'gender' | 'religion';

export const DEMOGRAPHIC_LABEL: Record<DemographicKey, string> = {
  age: 'Faixa etária',
  gender: 'Sexo',
  religion: 'Religião',
};

function demoValue(r: SurveyResponse, demo: DemographicKey): string | null {
  if (demo === 'age') return r.age_range ? (AGE_RANGE_LABEL[r.age_range] ?? r.age_range) : null;
  if (demo === 'gender') return r.gender ? (GENDER_LABEL[r.gender] ?? r.gender) : null;
  return r.religion ? (RELIGION_LABEL[r.religion] ?? r.religion) : null;
}

function answerLabels(r: SurveyResponse, qid: string): string[] {
  const v = r.answers?.[qid];
  if (!isFilled(v)) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [String(v)];
}

export interface CrossRow {
  group: string; // valor demográfico (ex: "35 a 44 anos")
  total: number;
  cells: { label: string; count: number; pct: number }[];
}

export interface CrossTab {
  columns: string[]; // rótulos das respostas (ordem consistente)
  rows: CrossRow[];
}

// Cruza uma pergunta (choice/yes_no) com uma demografia. Cada linha = grupo
// demográfico; células = distribuição das respostas dentro do grupo.
export function crossTabOf(
  question: SurveyFormQuestion,
  responses: SurveyResponse[],
  demo: DemographicKey,
): CrossTab {
  // Colunas = universo de respostas (mantém ordem de aparição / options).
  const colOrder: string[] =
    question.type === 'yes_no'
      ? ['Sim', 'Não']
      : (question.options ?? []).length
        ? [...(question.options ?? [])]
        : [];
  const colSet = new Set(colOrder);

  const matrix = new Map<string, Map<string, number>>();
  for (const r of responses) {
    const g = demoValue(r, demo);
    if (!g) continue;
    const labels = answerLabels(r, question.id);
    if (labels.length === 0) continue;
    if (!matrix.has(g)) matrix.set(g, new Map());
    const row = matrix.get(g)!;
    for (const l of labels) {
      row.set(l, (row.get(l) ?? 0) + 1);
      if (!colSet.has(l)) {
        colSet.add(l);
        colOrder.push(l);
      }
    }
  }

  const rows: CrossRow[] = [...matrix.entries()].map(([group, row]) => {
    const total = [...row.values()].reduce((s, n) => s + n, 0);
    const cells = colOrder.map((label) => {
      const count = row.get(label) ?? 0;
      return { label, count, pct: pct(count, total) };
    });
    return { group, total, cells };
  });
  rows.sort((a, b) => b.total - a.total);

  return { columns: colOrder, rows };
}

// ============================================================================
// Correlação — pergunta × pergunta (ou × demografia) + força (Cramér's V)
// ============================================================================

// Uma "variável" pra cruzar/correlacionar: uma demografia ou uma pergunta.
// Perguntas de valor único (yes_no/single_choice/scale_1_5) são correlacionáveis;
// multiple_choice e free_text não entram (valor não é categórico simples).
export type Variable =
  | { kind: 'demo'; key: DemographicKey; label: string }
  | { kind: 'question'; question: SurveyFormQuestion; label: string };

export function demoVariable(key: DemographicKey): Variable {
  return { kind: 'demo', key, label: DEMOGRAPHIC_LABEL[key] };
}
export function questionVariable(question: SurveyFormQuestion): Variable {
  return { kind: 'question', question, label: question.text };
}

export function isCorrelatable(q: SurveyFormQuestion): boolean {
  return q.type === 'yes_no' || q.type === 'single_choice' || q.type === 'scale_1_5';
}

function variableValue(r: SurveyResponse, v: Variable): string | null {
  if (v.kind === 'demo') return demoValue(r, v.key);
  const raw = r.answers?.[v.question.id];
  if (!isFilled(raw) || Array.isArray(raw)) return null; // multiple_choice fora
  return String(raw);
}

// Cruza uma pergunta com QUALQUER variável (demografia ou outra pergunta).
export function crossTab2(
  question: SurveyFormQuestion,
  groupBy: Variable,
  responses: SurveyResponse[],
): CrossTab {
  const colOrder: string[] =
    question.type === 'yes_no'
      ? ['Sim', 'Não']
      : (question.options ?? []).length
        ? [...(question.options ?? [])]
        : [];
  const colSet = new Set(colOrder);

  const matrix = new Map<string, Map<string, number>>();
  for (const r of responses) {
    const g = variableValue(r, groupBy);
    if (!g) continue;
    const labels = answerLabels(r, question.id);
    if (labels.length === 0) continue;
    if (!matrix.has(g)) matrix.set(g, new Map());
    const row = matrix.get(g)!;
    for (const l of labels) {
      row.set(l, (row.get(l) ?? 0) + 1);
      if (!colSet.has(l)) {
        colSet.add(l);
        colOrder.push(l);
      }
    }
  }

  const rows: CrossRow[] = [...matrix.entries()].map(([group, row]) => {
    const total = [...row.values()].reduce((s, n) => s + n, 0);
    const cells = colOrder.map((label) => ({
      label,
      count: row.get(label) ?? 0,
      pct: pct(row.get(label) ?? 0, total),
    }));
    return { group, total, cells };
  });
  rows.sort((a, b) => b.total - a.total);
  return { columns: colOrder, rows };
}

export interface Association {
  v: number; // Cramér's V (0–1)
  n: number; // respostas com ambas variáveis preenchidas
}

// Cramér's V — força da associação entre duas variáveis categóricas (0–1).
export function cramersV(a: Variable, b: Variable, responses: SurveyResponse[]): Association {
  const table = new Map<string, Map<string, number>>();
  const rowTot = new Map<string, number>();
  const colTot = new Map<string, number>();
  let n = 0;
  for (const r of responses) {
    const av = variableValue(r, a);
    const bv = variableValue(r, b);
    if (av === null || bv === null) continue;
    n++;
    if (!table.has(av)) table.set(av, new Map());
    const row = table.get(av)!;
    row.set(bv, (row.get(bv) ?? 0) + 1);
    rowTot.set(av, (rowTot.get(av) ?? 0) + 1);
    colTot.set(bv, (colTot.get(bv) ?? 0) + 1);
  }
  const k = Math.min(rowTot.size, colTot.size);
  if (n === 0 || k <= 1) return { v: 0, n };

  let chi2 = 0;
  for (const [av, rt] of rowTot) {
    for (const [bv, ct] of colTot) {
      const observed = table.get(av)?.get(bv) ?? 0;
      const expected = (rt * ct) / n;
      if (expected > 0) chi2 += (observed - expected) ** 2 / expected;
    }
  }
  const v = Math.sqrt(chi2 / (n * (k - 1)));
  return { v: Math.min(1, Math.round(v * 100) / 100), n };
}

export type StrengthLevel = 'Fraca' | 'Moderada' | 'Forte' | 'Muito forte';

export function strengthOf(v: number): StrengthLevel {
  if (v >= 0.55) return 'Muito forte';
  if (v >= 0.35) return 'Forte';
  if (v >= 0.15) return 'Moderada';
  return 'Fraca';
}

export interface Correlation {
  a: Variable;
  b: Variable;
  v: number;
  n: number;
}

// Detecta os pares mais correlacionados: todas as perguntas correlacionáveis
// entre si + cada pergunta × cada demografia. Filtra por força mínima e amostra.
export function topCorrelations(
  questions: SurveyFormQuestion[],
  responses: SurveyResponse[],
  opts: { minV?: number; minN?: number; limit?: number } = {},
): Correlation[] {
  const minV = opts.minV ?? 0.2;
  const minN = opts.minN ?? 5;
  const limit = opts.limit ?? 6;

  const qVars = questions.filter(isCorrelatable).map(questionVariable);
  const demoVars: Variable[] = (['age', 'gender', 'religion'] as DemographicKey[]).map(
    demoVariable,
  );

  const out: Correlation[] = [];

  // pergunta × pergunta
  for (let i = 0; i < qVars.length; i++) {
    for (let j = i + 1; j < qVars.length; j++) {
      const { v, n } = cramersV(qVars[i], qVars[j], responses);
      if (v >= minV && n >= minN) out.push({ a: qVars[i], b: qVars[j], v, n });
    }
  }
  // pergunta × demografia
  for (const q of qVars) {
    for (const d of demoVars) {
      const { v, n } = cramersV(q, d, responses);
      if (v >= minV && n >= minN) out.push({ a: q, b: d, v, n });
    }
  }

  out.sort((x, y) => y.v - x.v);
  return out.slice(0, limit);
}
