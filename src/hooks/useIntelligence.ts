import { useEffect, useMemo, useState } from 'react';
import { collections, useCollection } from '@/lib/data';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import {
  calculateStats,
  type ComputedStats,
} from '@/lib/statsCalculator';
import {
  intelligenceFromStats,
  runIntelligenceJob,
  summarizeSample,
  type SampleSummary,
} from '@/lib/intelligenceJob';
import { SEED_INTELLIGENCE } from '@/data/seeds-intelligence';
import { surveyResponsesToInterviews } from '@/lib/surveyResponseAdapter';
import type { CampaignIntelligence, FieldInterview, SurveyResponse } from '@/types';

export interface UseIntelligenceResult {
  stats: ComputedStats;
  // Última análise salva no banco (com IA) OU snapshot derivado de stats locais.
  // Quando há linha salva, ai_filled === true.
  intelligence: CampaignIntelligence;
  ai_filled: boolean;
  loading: boolean;
  running: boolean;
  sample: SampleSummary;
  refresh: () => Promise<void>;
}

export function useIntelligence(): UseIntelligenceResult {
  const session = useAuthStore((s) => s.session);
  const interviews = useCollection(collections.interviews);

  // Fase 5B: respostas dos Formulários de Pesquisa (survey_responses) entram
  // na Inteligência via adaptador. Só demografia (faixa/sexo/religião); sem
  // intenção de voto (excluída por design). Carregado à parte do store legado.
  const [surveyRows, setSurveyRows] = useState<SurveyResponse[]>([]);
  useEffect(() => {
    let active = true;
    async function loadSurvey() {
      if (!session?.campaign || USE_MOCKS) {
        setSurveyRows([]);
        return;
      }
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('campaign_id', session.campaign.id)
        .limit(5000);
      if (!active) return;
      if (error) {
        console.warn('useIntelligence(survey_responses):', error.message);
        setSurveyRows([]);
        return;
      }
      setSurveyRows((data ?? []) as SurveyResponse[]);
    }
    void loadSurvey();
    return () => {
      active = false;
    };
  }, [session?.campaign?.id]);

  // Restringe a entrevistas da campanha atual + apenas as "completas" pra
  // que análise represente a base real de pesquisa. Mescla as respostas dos
  // formulários novos (adaptadas) — enriquecem só as distribuições demográficas.
  const dataset = useMemo<FieldInterview[]>(() => {
    if (!session?.campaign) return [];
    const legacy = interviews.filter(
      (i) =>
        i.campaign_id === session.campaign!.id &&
        i.status !== 'draft', // 'basic' e 'complete' contam
    );
    return [...legacy, ...surveyResponsesToInterviews(surveyRows)];
  }, [interviews, session?.campaign, surveyRows]);

  const stats = useMemo(() => calculateStats(dataset), [dataset]);
  const sample = useMemo(() => summarizeSample(dataset), [dataset]);

  const [saved, setSaved] = useState<CampaignIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  // Carrega a análise mais recente quando temos campanha + modo Supabase.
  // Em mock mode, usa o seed.
  useEffect(() => {
    let active = true;
    async function load() {
      if (!session?.campaign) return;
      if (USE_MOCKS) {
        // Mock: usa seed como se fosse a última análise.
        setSaved({ ...SEED_INTELLIGENCE, campaign_id: session.campaign.id });
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from('campaign_intelligence')
        .select('*')
        .eq('campaign_id', session.campaign.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setLoading(false);
      if (error) {
        console.warn('intelligence load:', error.message);
        return;
      }
      if (data) setSaved(data as CampaignIntelligence);
    }
    void load();
    return () => {
      active = false;
    };
  }, [session?.campaign?.id]);

  const fallback = useMemo(
    () => intelligenceFromStats(session?.campaign?.id ?? '', stats),
    [stats, session?.campaign?.id],
  );
  const intelligence = saved ?? fallback;
  const ai_filled = !!saved && !!saved.resumo_executivo;

  async function refresh() {
    if (!session?.campaign) return;
    setRunning(true);
    try {
      const result = await runIntelligenceJob(session.campaign.id);
      if (USE_MOCKS) {
        // No mock, regenera apenas a base do seed pra "simular" atualização.
        setSaved({
          ...SEED_INTELLIGENCE,
          campaign_id: session.campaign.id,
          generated_at: new Date().toISOString(),
        });
        return;
      }
      // Em modo real, releitura da tabela após a edge function inserir.
      if (result.ok) {
        const { data } = await supabase
          .from('campaign_intelligence')
          .select('*')
          .eq('campaign_id', session.campaign.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setSaved(data as CampaignIntelligence);
      }
    } finally {
      setRunning(false);
    }
  }

  return { stats, intelligence, ai_filled, loading, running, sample, refresh };
}
