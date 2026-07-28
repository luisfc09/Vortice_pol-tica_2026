// ============================================================================
// useSurveyForms — CRUD dos Formulários de Pesquisa (migration 052).
// Escopo: campanha efetiva (respeita view-as). RLS garante isolamento.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import type { SurveyForm, SurveyFormQuestion } from '@/types';

export function useSurveyForms() {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;

  const [forms, setForms] = useState<SurveyForm[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!campaignId || USE_MOCKS) {
      setForms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('survey_forms')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.warn('useSurveyForms:', error.message);
      setForms([]);
      return;
    }
    setForms((data ?? []) as SurveyForm[]);
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: contagem de respostas / mudanças de status.
  useEffect(() => {
    if (!campaignId || USE_MOCKS) return;
    const channel = supabase
      .channel(`survey-forms-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'survey_forms',
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, load]);

  return { forms, loading, reload: load };
}

// ----------------------------------------------------------------------------
// Detalhe de um formulário + suas perguntas (ordenadas por position).
// ----------------------------------------------------------------------------
export function useSurveyFormDetail(formId: string | undefined) {
  const [form, setForm] = useState<SurveyForm | null>(null);
  const [questions, setQuestions] = useState<SurveyFormQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!formId || USE_MOCKS) {
      setForm(null);
      setQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [formRes, questionsRes] = await Promise.all([
      supabase.from('survey_forms').select('*').eq('id', formId).maybeSingle(),
      supabase
        .from('survey_form_questions')
        .select('*')
        .eq('form_id', formId)
        .order('position', { ascending: true }),
    ]);
    setLoading(false);
    if (formRes.error) console.warn('useSurveyFormDetail(form):', formRes.error.message);
    if (questionsRes.error)
      console.warn('useSurveyFormDetail(questions):', questionsRes.error.message);
    setForm((formRes.data as SurveyForm | null) ?? null);
    setQuestions((questionsRes.data ?? []) as SurveyFormQuestion[]);
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { form, questions, loading, reload: load };
}
