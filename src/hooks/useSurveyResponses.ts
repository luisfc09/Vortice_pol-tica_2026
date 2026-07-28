// ============================================================================
// useSurveyResponses — respostas de um Formulário de Pesquisa (repositório,
// Fase 4). Lê survey_responses (presencial + público) + nomes dos
// entrevistadores. RLS garante o escopo (admin/candidate/coord/researcher).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import type { SurveyResponse } from '@/types';

export function useSurveyResponses(formId: string | undefined) {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [interviewerNames, setInterviewerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!formId || USE_MOCKS) {
      setResponses([]);
      setInterviewerNames({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false })
      .limit(2000);
    if (error) {
      console.warn('useSurveyResponses:', error.message);
      setResponses([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as SurveyResponse[];
    setResponses(rows);

    // Nomes dos entrevistadores (presencial).
    const ids = Array.from(
      new Set(rows.map((r) => r.interviewer_id).filter((v): v is string => !!v)),
    );
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      const map: Record<string, string> = {};
      for (const p of (profs ?? []) as { id: string; full_name: string }[]) {
        map[p.id] = p.full_name;
      }
      setInterviewerNames(map);
    } else {
      setInterviewerNames({});
    }
    setLoading(false);
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { responses, interviewerNames, loading, reload: load };
}
