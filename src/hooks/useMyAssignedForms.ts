// ============================================================================
// useMyAssignedForms — formulários que o usuário logado está autorizado a
// aplicar (presencial). Lê survey_form_assignments do próprio user + os
// survey_forms ativos correspondentes (migration 052, Fase 2).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import type { SurveyForm } from '@/types';

export function useMyAssignedForms() {
  const session = useEffectiveSession();
  const userId = session?.id ?? null;
  const campaignId = session?.campaign?.id ?? null;

  const [forms, setForms] = useState<SurveyForm[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId || !campaignId || USE_MOCKS) {
      setForms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: assigns, error: aErr } = await supabase
      .from('survey_form_assignments')
      .select('form_id')
      .eq('user_id', userId);
    if (aErr) {
      console.warn('useMyAssignedForms(assign):', aErr.message);
      setForms([]);
      setLoading(false);
      return;
    }
    const formIds = ((assigns ?? []) as { form_id: string }[]).map((a) => a.form_id);
    if (formIds.length === 0) {
      setForms([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('survey_forms')
      .select('*')
      .in('id', formIds)
      .eq('is_active', true)
      .order('name', { ascending: true });
    setLoading(false);
    if (error) {
      console.warn('useMyAssignedForms(forms):', error.message);
      setForms([]);
      return;
    }
    setForms((data ?? []) as SurveyForm[]);
  }, [userId, campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { forms, loading, reload: load };
}
