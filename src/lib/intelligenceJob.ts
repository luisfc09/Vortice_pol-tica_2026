// Orquestrador do job de análise de inteligência eleitoral.
//
// Chama a edge function `intelligence-analyze` no Supabase, que faz
// a chamada à IA e grava em campaign_intelligence. O frontend só dispara
// e aguarda — quando voltar, o realtime/manual reload da coleção pega
// o resultado.
//
// Fallback gracioso: se a edge function falhar ou não existir, o frontend
// ainda consegue mostrar as estatísticas calculadas localmente (sem IA).

import { supabase, USE_MOCKS } from '@/lib/supabase';
import type { ComputedStats } from '@/lib/statsCalculator';
import { reliabilityOf, type CampaignIntelligence, type FieldInterview } from '@/types';

export interface IntelligenceJobResult {
  ok: boolean;
  message: string;
  intelligenceId?: string;
}

export async function runIntelligenceJob(
  campaignId: string,
): Promise<IntelligenceJobResult> {
  if (USE_MOCKS) {
    // Em mock mode a "análise" é instantânea (já temos seed).
    return { ok: true, message: 'Análise mock atualizada.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('intelligence-analyze', {
      body: { campaign_id: campaignId },
    });
    if (error) {
      // Falha: edge function ainda não deployada OU erro interno
      return {
        ok: false,
        message: `Falha ao chamar IA: ${error.message}. Use as estatísticas locais por enquanto.`,
      };
    }
    return {
      ok: true,
      message: 'Análise atualizada.',
      intelligenceId: (data as { id?: string } | null)?.id,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'erro desconhecido',
    };
  }
}

// ----------------------------------------------------------------------------
// Compõe um snapshot de Intelligence a partir de stats locais + IA (opcional).
// Usado pelo hook quando não há linha salva — assim a UI nunca aparece vazia.
// ----------------------------------------------------------------------------

export function intelligenceFromStats(
  campaignId: string,
  stats: ComputedStats,
): CampaignIntelligence {
  return {
    id: 'local-stats',
    campaign_id: campaignId,
    generated_at: new Date().toISOString(),
    total_interviews: stats.total,
    vote_intention_dist: stats.vote_intention_dist,
    age_dist: stats.age_dist,
    gender_dist: stats.gender_dist,
    religion_dist: stats.religion_dist,
    income_dist: stats.income_dist,
    education_dist: stats.education_dist,
    crossings: stats.crossings,
    themes_ranking: stats.themes_ranking,
    themes_by_region: stats.themes_by_region,
    themes_by_profile: stats.themes_by_profile,
    gov_ratings: stats.gov_ratings,
    sentiment_analysis: stats.sentiment_analysis,
    resumo_executivo: null,
    strategic_insights: [],
    risk_alerts: [],
    opportunities: [],
    recommended_actions: [],
    segments_to_convert: stats.segments_to_convert,
    segments_at_risk: [],
    mensagens_por_segmento: null,
    comparacao_institutos: null,
    conversion_probability: null,
    campaign_health_score: null,
    raw_analysis: null,
  };
}

// Heurística para a barra de status quando não há IA: deriva um score
// rude do conversion + total. Apenas para a UI exibir algo enquanto a
// IA não roda.
export function deriveHealthScore(stats: ComputedStats): number {
  const favoraveis =
    (stats.vote_intention_dist.find((d) => /apoiador|favor/i.test(d.label))?.pct ?? 0) +
    (stats.vote_intention_dist.find((d) => /tendência a apoiar|tendencia/i.test(d.label))?.pct ?? 0);
  const oposicao =
    (stats.vote_intention_dist.find((d) => /oposição|contra/i.test(d.label))?.pct ?? 0);
  const liquid = favoraveis - oposicao;
  const sample = Math.min(1, stats.total / 500);
  return Math.max(0, Math.min(100, Math.round(50 + liquid * 0.7) * sample + (1 - sample) * 50));
}

export interface SampleSummary {
  total: number;
  reliability: ReturnType<typeof reliabilityOf>;
  deepenedRatio: number; // % entrevistas com questionário aprofundado
}

export function summarizeSample(items: FieldInterview[]): SampleSummary {
  const total = items.length;
  const deepened = items.filter((i) => !!i.age_range).length;
  return {
    total,
    reliability: reliabilityOf(total),
    deepenedRatio: total > 0 ? Math.round((deepened / total) * 100) : 0,
  };
}
