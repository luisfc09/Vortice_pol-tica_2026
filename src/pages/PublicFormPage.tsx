// ============================================================================
// PublicFormPage — rota PÚBLICA /f/:token (sem login). O eleitor responde um
// Formulário de Pesquisa publicado. Submete via edge function
// survey-form-submit → survey_responses (channel='publico'). (migration 053)
// ============================================================================

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePublicSurveyForm } from '@/hooks/usePublicSurveyForm';
import { SurveyFillForm, type FillPayload } from '@/components/pesquisas/SurveyFillForm';
import type { PublicSurveySubmitError } from '@/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const ERROR_MESSAGES: Record<PublicSurveySubmitError, string> = {
  not_found: 'Este link não é válido.',
  inactive: 'Essa pesquisa está pausada no momento.',
  not_started: 'Essa pesquisa ainda não começou.',
  ended: 'Essa pesquisa foi encerrada.',
  duplicate_ip: 'Você já respondeu essa pesquisa. Obrigado!',
  invalid_json: 'Erro ao enviar. Tente novamente.',
  token_missing: 'Link inválido.',
  invalid_answers: 'Formato de respostas inválido.',
  rpc_failed: 'Erro no servidor. Tente novamente em alguns instantes.',
  server_misconfigured: 'Servidor indisponível. Volte mais tarde.',
  salt_not_configured: 'Servidor indisponível. Volte mais tarde.',
  unknown: 'Erro desconhecido. Tente novamente.',
};

export default function PublicFormPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { form, status } = usePublicSurveyForm(token);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(payload: FillPayload) {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/survey-form-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
        body: JSON.stringify({
          token,
          answers: payload.answers,
          name: payload.respondent_name || undefined,
          age_range: payload.age_range || undefined,
          gender: payload.gender || undefined,
          religion: payload.religion || undefined,
          phone: payload.respondent_phone || undefined,
          municipality_code: payload.municipality_code || undefined,
          neighborhood: payload.neighborhood || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: PublicSurveySubmitError;
      };
      if (!res.ok || !body.ok) {
        toast.error(ERROR_MESSAGES[body.error ?? 'unknown'] ?? ERROR_MESSAGES.unknown);
        return;
      }
      navigate(`/f/${token}/obrigado`, { replace: true });
    } catch (err) {
      console.error('[PublicFormPage] submit', err);
      toast.error('Sem conexão. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-vortex-bg p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando pesquisa…</span>
        </div>
      </div>
    );
  }

  if (!form || status !== 'ok') {
    const message =
      status === 'inactive'
        ? 'Essa pesquisa está pausada.'
        : status === 'ended'
          ? 'Essa pesquisa já foi encerrada.'
          : status === 'not_started'
            ? 'Essa pesquisa ainda não começou.'
            : status === 'network_error'
              ? 'Não conseguimos carregar. Verifique sua conexão.'
              : 'Este link não é válido.';
    return (
      <div className="flex min-h-screen items-center justify-center bg-vortex-bg p-6">
        <div className="max-w-md space-y-3 rounded-lg border border-border/40 bg-card/50 p-6 text-center">
          <p className="text-2xl">⚠️</p>
          <p className="text-lg font-medium">{message}</p>
          <p className="text-sm text-muted-foreground">
            Se você recebeu esse link recentemente, peça um novo para quem enviou.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vortex-bg px-4 py-6">
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-primary">Pesquisa</p>
          <h1 className="font-display text-2xl leading-tight text-foreground sm:text-3xl">
            {form.name}
          </h1>
          {form.description ? (
            <p className="text-sm text-muted-foreground">{form.description}</p>
          ) : null}
        </header>

        <SurveyFillForm
          form={form}
          questions={form.questions}
          submitting={submitting}
          onSubmit={(p) => void handleSubmit(p)}
        />

        <p className="pt-6 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Pesquisa via Vórtice
        </p>
      </div>
    </div>
  );
}
