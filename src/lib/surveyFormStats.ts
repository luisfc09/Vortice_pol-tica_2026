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
