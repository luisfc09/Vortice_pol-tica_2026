// ============================================================================
// usePublicSurveys — CRUD admin de pesquisas públicas (migration 050).
// Escopo: campanha efetiva (respeita view-as via useEffectiveSession).
// RLS garante isolamento; hook só orquestra fetches + realtime.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import type { PublicSurvey } from '@/types';

export function usePublicSurveys() {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;

  const [surveys, setSurveys] = useState<PublicSurvey[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!campaignId || USE_MOCKS) {
      setSurveys([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('public_surveys')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.warn('usePublicSurveys:', error.message);
      setSurveys([]);
      return;
    }
    setSurveys((data ?? []) as PublicSurvey[]);
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: quando muda contagem/status via trigger (ou UPDATE do admin).
  useEffect(() => {
    if (!campaignId || USE_MOCKS) return;
    const channel = supabase
      .channel(`public-surveys-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'public_surveys',
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, load]);

  return { surveys, loading, reload: load };
}

// ----------------------------------------------------------------------------
// Detalhe de uma pesquisa + questões vinculadas + respostas.
// ----------------------------------------------------------------------------
export function usePublicSurveyDetail(surveyId: string | undefined) {
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [questionLinks, setQuestionLinks] = useState<
    { id: string; question_id: string; position: number; is_required: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!surveyId || USE_MOCKS) {
      setSurvey(null);
      setQuestionLinks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [surveyRes, linksRes] = await Promise.all([
      supabase.from('public_surveys').select('*').eq('id', surveyId).maybeSingle(),
      supabase
        .from('public_survey_questions')
        .select('id, question_id, position, is_required')
        .eq('survey_id', surveyId)
        .order('position', { ascending: true }),
    ]);
    setLoading(false);
    if (surveyRes.error) {
      console.warn('usePublicSurveyDetail(survey):', surveyRes.error.message);
    }
    if (linksRes.error) {
      console.warn('usePublicSurveyDetail(links):', linksRes.error.message);
    }
    setSurvey((surveyRes.data as PublicSurvey | null) ?? null);
    setQuestionLinks(linksRes.data ?? []);
  }, [surveyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { survey, questionLinks, loading, reload: load };
}
