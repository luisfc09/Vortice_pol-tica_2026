// ============================================================================
// usePublicSurveyForm — hook público (/f/:token, sem session). Chama a RPC
// get_survey_form_by_token via cliente anon (migration 053). Nunca lança.
// ============================================================================

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SurveyFormPublicView } from '@/types';

export type PublicFormStatus =
  | 'loading'
  | 'ok'
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'ended'
  | 'network_error';

interface RpcResponse {
  error?: string;
  id?: string;
  campaign_id?: string;
  name?: string;
  description?: string | null;
  collect_phone?: boolean;
  collect_municipality?: boolean;
  collect_neighborhood?: boolean;
  questions?: SurveyFormPublicView['questions'];
}

export function usePublicSurveyForm(token: string | undefined) {
  const [form, setForm] = useState<SurveyFormPublicView | null>(null);
  const [status, setStatus] = useState<PublicFormStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) {
        setStatus('not_found');
        setForm(null);
        return;
      }
      setStatus('loading');
      const { data, error } = await supabase.rpc('get_survey_form_by_token', {
        p_token: token,
      });
      if (cancelled) return;
      if (error) {
        console.warn('usePublicSurveyForm:', error.message);
        setStatus('network_error');
        setForm(null);
        return;
      }
      const payload = (data ?? {}) as RpcResponse;
      if (payload.error) {
        setStatus(payload.error as PublicFormStatus);
        setForm(null);
        return;
      }
      if (!payload.id) {
        setStatus('not_found');
        setForm(null);
        return;
      }
      setForm({
        id: payload.id,
        campaign_id: payload.campaign_id ?? '',
        name: payload.name ?? '',
        description: payload.description ?? null,
        collect_phone: payload.collect_phone ?? false,
        collect_municipality: payload.collect_municipality ?? false,
        collect_neighborhood: payload.collect_neighborhood ?? false,
        questions: payload.questions ?? [],
      });
      setStatus('ok');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { form, status };
}
