// ============================================================================
// usePublicSurvey — hook público que roda na rota /p/:token (sem session).
// Chama a RPC get_public_survey_by_token via cliente anon (RLS bypassed pela
// SECURITY DEFINER). Devolve { survey | null, status } — nunca lança.
// ============================================================================

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { PublicSurveyPublicView } from '@/types';

export type PublicSurveyStatus =
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
  title?: string;
  description?: string | null;
  ask_name?: boolean;
  ask_phone?: boolean;
  ask_location?: boolean;
  questions?: PublicSurveyPublicView['questions'];
}

export function usePublicSurvey(token: string | undefined) {
  const [survey, setSurvey] = useState<PublicSurveyPublicView | null>(null);
  const [status, setStatus] = useState<PublicSurveyStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) {
        setStatus('not_found');
        setSurvey(null);
        return;
      }
      setStatus('loading');
      const { data, error } = await supabase.rpc('get_public_survey_by_token', {
        p_token: token,
      });
      if (cancelled) return;
      if (error) {
        console.warn('usePublicSurvey:', error.message);
        setStatus('network_error');
        setSurvey(null);
        return;
      }
      const payload = (data ?? {}) as RpcResponse;
      if (payload.error) {
        setStatus(payload.error as PublicSurveyStatus);
        setSurvey(null);
        return;
      }
      if (!payload.id) {
        setStatus('not_found');
        setSurvey(null);
        return;
      }
      setSurvey({
        id: payload.id,
        campaign_id: payload.campaign_id ?? '',
        title: payload.title ?? '',
        description: payload.description ?? null,
        ask_name: payload.ask_name ?? true,
        ask_phone: payload.ask_phone ?? true,
        ask_location: payload.ask_location ?? true,
        questions: payload.questions ?? [],
      });
      setStatus('ok');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { survey, status };
}
