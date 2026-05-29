// Helpers das perguntas regionais por campanha (migration 034).
//
// - Tipos do estado de resposta usados pelo Bloco 6 da entrevista.
// - salvarRespostasRegionais(): grava em interview_custom_answers (upsert).
// - aggregateQuestion(): agregação PURA por tipo de pergunta, reusada pela
//   página de Inteligência (hook useCustomQuestionsAnalytics).

import { supabase, USE_MOCKS } from '@/lib/supabase';
import type {
  CampaignQuestion,
  CampaignQuestionType,
  InterviewCustomAnswer,
} from '@/types';

// ----------------------------------------------------------------------------
// Estado de resposta (Bloco 6)
// ----------------------------------------------------------------------------
export interface CustomAnswerValue {
  type: CampaignQuestionType;
  optionValue?: string | null; // yes_no, single_choice
  optionValues?: string[]; // multiple_choice
  scaleValue?: number | null; // scale_1_5
  textValue?: string; // free_text
}

// Keyed por question_id.
export type CustomAnswersState = Record<string, CustomAnswerValue>;

// A resposta tem valor preenchido? (perguntas opcionais não respondidas
// não geram registro).
export function answerHasValue(a: CustomAnswerValue | undefined): boolean {
  if (!a) return false;
  switch (a.type) {
    case 'free_text':
      return !!a.textValue && a.textValue.trim().length > 0;
    case 'yes_no':
    case 'single_choice':
      return !!a.optionValue;
    case 'multiple_choice':
      return (a.optionValues?.length ?? 0) > 0;
    case 'scale_1_5':
      return a.scaleValue != null;
    default:
      return false;
  }
}

// ----------------------------------------------------------------------------
// Salvar respostas regionais de uma entrevista
// ----------------------------------------------------------------------------
export async function salvarRespostasRegionais(
  interviewId: string,
  campaignId: string,
  answers: CustomAnswersState,
): Promise<void> {
  if (USE_MOCKS) return;

  const rows = Object.entries(answers)
    .filter(([, a]) => answerHasValue(a))
    .map(([questionId, a]) => ({
      interview_id: interviewId,
      campaign_id: campaignId,
      question_id: questionId,
      answer_text: a.type === 'free_text' ? (a.textValue?.trim() ?? null) : null,
      answer_option:
        a.type === 'yes_no' || a.type === 'single_choice' ? (a.optionValue ?? null) : null,
      answer_options: a.type === 'multiple_choice' ? (a.optionValues ?? null) : null,
      answer_scale: a.type === 'scale_1_5' ? (a.scaleValue ?? null) : null,
    }));

  if (rows.length === 0) return;

  // upsert por (interview_id, question_id) — suporta re-edição do questionário
  // sem duplicar (a tabela tem unique nesse par).
  const { error } = await supabase
    .from('interview_custom_answers')
    .upsert(rows, { onConflict: 'interview_id,question_id' });
  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------------------------
// Agregação por tipo (pura) — usada na Inteligência Eleitoral
// ----------------------------------------------------------------------------
export interface QuestionDistributionItem {
  label: string;
  count: number;
  pct: number; // 0-100
}

export interface QuestionAnalytics {
  question: CampaignQuestion;
  total: number; // nº de respostas válidas
  distribution: QuestionDistributionItem[];
  average: number | null; // só scale_1_5
}

type RawAnswer = Pick<
  InterviewCustomAnswer,
  'answer_text' | 'answer_option' | 'answer_options' | 'answer_scale'
>;

function countBy(arr: Array<string | null | undefined>): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of arr) {
    if (k == null || k === '') continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export function aggregateQuestion(
  question: CampaignQuestion,
  answers: RawAnswer[],
): QuestionAnalytics {
  const opts = Array.isArray(question.options) ? question.options : [];

  switch (question.type) {
    case 'yes_no': {
      const valid = answers.filter((a) => !!a.answer_option);
      const counts = countBy(valid.map((a) => a.answer_option));
      const labels = ['Sim', 'Não'];
      // inclui qualquer valor inesperado fora de Sim/Não
      for (const k of counts.keys()) if (!labels.includes(k)) labels.push(k);
      const distribution = labels
        .filter((l) => counts.has(l))
        .map((label) => ({ label, count: counts.get(label) ?? 0, pct: pct(counts.get(label) ?? 0, valid.length) }));
      return { question, total: valid.length, distribution, average: null };
    }

    case 'single_choice': {
      const valid = answers.filter((a) => !!a.answer_option);
      const counts = countBy(valid.map((a) => a.answer_option));
      const labels = opts.length ? opts.slice() : [...counts.keys()];
      for (const k of counts.keys()) if (!labels.includes(k)) labels.push(k);
      const distribution = labels.map((label) => ({
        label,
        count: counts.get(label) ?? 0,
        pct: pct(counts.get(label) ?? 0, valid.length),
      }));
      return { question, total: valid.length, distribution, average: null };
    }

    case 'multiple_choice': {
      const valid = answers.filter(
        (a) => Array.isArray(a.answer_options) && a.answer_options.length > 0,
      );
      const counts = new Map<string, number>();
      for (const a of valid) for (const o of a.answer_options ?? []) {
        counts.set(o, (counts.get(o) ?? 0) + 1);
      }
      const labels = opts.length ? opts.slice() : [...counts.keys()];
      for (const k of counts.keys()) if (!labels.includes(k)) labels.push(k);
      // pct sobre nº de respondentes (não soma 100%)
      const distribution = labels.map((label) => ({
        label,
        count: counts.get(label) ?? 0,
        pct: pct(counts.get(label) ?? 0, valid.length),
      }));
      return { question, total: valid.length, distribution, average: null };
    }

    case 'scale_1_5': {
      const valid = answers.filter((a) => a.answer_scale != null);
      const counts = countBy(valid.map((a) => String(a.answer_scale)));
      const distribution = ['5', '4', '3', '2', '1'].map((label) => ({
        label,
        count: counts.get(label) ?? 0,
        pct: pct(counts.get(label) ?? 0, valid.length),
      }));
      const sum = valid.reduce((s, a) => s + (a.answer_scale ?? 0), 0);
      const average = valid.length > 0 ? Math.round((sum / valid.length) * 10) / 10 : null;
      return { question, total: valid.length, distribution, average };
    }

    case 'free_text': {
      const valid = answers.filter((a) => !!a.answer_text && a.answer_text.trim().length > 0);
      // normaliza (lowercase + trim) pra contar; mantém 1º original como label
      const counts = new Map<string, { label: string; count: number }>();
      for (const a of valid) {
        const norm = a.answer_text!.trim().toLowerCase();
        const existing = counts.get(norm);
        if (existing) existing.count += 1;
        else counts.set(norm, { label: a.answer_text!.trim(), count: 1 });
      }
      const distribution = [...counts.values()]
        .sort((x, y) => y.count - x.count)
        .slice(0, 10)
        .map((s) => ({ label: s.label, count: s.count, pct: pct(s.count, valid.length) }));
      return { question, total: valid.length, distribution, average: null };
    }

    default:
      return { question, total: 0, distribution: [], average: null };
  }
}
