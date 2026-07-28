// ============================================================================
// surveyTrends — tendências automáticas de um formulário (Fase 6).
// Heurísticas puras sobre survey_responses: consenso por pergunta, perfil
// demográfico dominante e desvios notáveis no cruzamento pergunta × demografia.
// Sem IA — estatística direta. Guarda contra amostra pequena.
// ============================================================================

import {
  aggregateQuestion,
  crossTabOf,
  demographicsOf,
  sampleOf,
  DEMOGRAPHIC_LABEL,
  type DemographicKey,
} from './surveyFormStats';
import type { SurveyFormQuestion, SurveyResponse } from '@/types';

export type TrendTone = 'positive' | 'negative' | 'neutral' | 'warning';

export interface Trend {
  tone: TrendTone;
  text: string;
}

const DEMO_KEYS: DemographicKey[] = ['age', 'gender', 'religion'];

export function computeTrends(
  questions: SurveyFormQuestion[],
  responses: SurveyResponse[],
): Trend[] {
  const sample = sampleOf(responses);
  if (sample.total === 0) return [];

  const trends: Trend[] = [];

  // Amostra pequena — aviso honesto.
  if (sample.total < 10) {
    trends.push({
      tone: 'warning',
      text: `Amostra pequena (${sample.total} resposta${sample.total === 1 ? '' : 's'}) — as tendências são indicativas até a base crescer.`,
    });
  }

  // Perfil demográfico dominante.
  const demo = demographicsOf(responses);
  for (const k of DEMO_KEYS) {
    const items = demo[k];
    const top = items[0];
    if (top && top.pct >= 50 && items.length > 1) {
      trends.push({
        tone: 'neutral',
        text: `Público majoritariamente ${top.label} (${top.pct}%) em ${DEMOGRAPHIC_LABEL[k].toLowerCase()}.`,
      });
    }
  }

  // Consenso + cruzamentos por pergunta de escolha.
  const choiceQs = questions.filter(
    (q) =>
      q.type === 'yes_no' || q.type === 'single_choice' || q.type === 'multiple_choice',
  );
  for (const q of choiceQs) {
    const agg = aggregateQuestion(q, responses);
    if (agg.total === 0) continue;
    const top = agg.distribution[0];
    if (!top || top.count === 0) continue;

    // Consenso forte (>= 60%).
    if (top.pct >= 60) {
      const tone: TrendTone =
        q.type === 'yes_no'
          ? top.label === 'Sim'
            ? 'positive'
            : 'negative'
          : 'neutral';
      trends.push({
        tone,
        text: `${top.pct}% responderam “${top.label}” em “${q.text}”.`,
      });
    }

    // Cruzamento: grupo demográfico onde a resposta dominante desvia forte
    // do geral (>= 20 p.p.), com grupo de tamanho mínimo.
    for (const k of DEMO_KEYS) {
      const ct = crossTabOf(q, responses, k);
      let best: { group: string; pct: number } | null = null;
      for (const row of ct.rows) {
        if (row.total < 3) continue;
        const cell = row.cells.find((c) => c.label === top.label);
        if (!cell) continue;
        if (cell.pct - top.pct >= 20 && (!best || cell.pct > best.pct)) {
          best = { group: row.group, pct: cell.pct };
        }
      }
      if (best) {
        trends.push({
          tone: 'neutral',
          text: `Entre ${best.group}, “${top.label}” chega a ${best.pct}% (vs ${top.pct}% no geral) em “${q.text}”.`,
        });
      }
    }
  }

  // Limita pra não poluir.
  return trends.slice(0, 10);
}
