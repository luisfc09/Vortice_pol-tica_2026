// Hook que carrega as perguntas regionais da campanha efetiva.
// Padrão do projeto: useEffectiveSession (respeita "ver como cliente") +
// supabase direto. RLS já garante o escopo por campanha.

import { useCallback, useEffect, useState } from 'react';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import type { CampaignQuestion } from '@/types';

interface UseCampaignQuestionsOptions {
  /** true (default) = só perguntas ativas (entrevista). false = todas (gestão). */
  activeOnly?: boolean;
  /** false = não busca (ex.: usuário sem permissão). Default true. */
  enabled?: boolean;
}

export function useCampaignQuestions(options: UseCampaignQuestionsOptions = {}) {
  const activeOnly = options.activeOnly ?? true;
  const enabled = options.enabled ?? true;
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;

  const [questions, setQuestions] = useState<CampaignQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!campaignId || !enabled || USE_MOCKS) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase
      .from('campaign_questions')
      .select('*')
      .eq('campaign_id', campaignId);
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q.order('sort_order', { ascending: true });
    setLoading(false);
    if (error) {
      console.warn('useCampaignQuestions:', error.message);
      setQuestions([]);
      return;
    }
    setQuestions((data ?? []) as CampaignQuestion[]);
  }, [campaignId, activeOnly, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    questions,
    loading,
    hasQuestions: questions.length > 0,
    reload: load,
  };
}
