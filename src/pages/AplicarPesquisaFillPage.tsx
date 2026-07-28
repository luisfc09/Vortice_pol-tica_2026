// ============================================================================
// AplicarPesquisaFillPage — entrevistador preenche um Formulário de Pesquisa
// (migration 052, Fase 2). Grava em survey_responses (channel='presencial').
// A RLS survey_responses_insert_presencial exige que o user esteja autorizado.
//
// Fluxo de campo (aplicação em sequência): depois de salvar, o formulário
// limpa sozinho e já fica pronto pro próximo eleitor, com contador da sessão.
// ============================================================================

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SurveyFillForm, type FillPayload } from '@/components/pesquisas/SurveyFillForm';
import { useSurveyFormDetail } from '@/hooks/useSurveyForms';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { supabase } from '@/lib/supabase';

export default function AplicarPesquisaFillPage() {
  const { id } = useParams<{ id: string }>();
  const session = useEffectiveSession();
  const { form, questions, loading } = useSurveyFormDetail(id);
  const [submitting, setSubmitting] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  // Remontar o form (via key) limpa o estado interno pro próximo eleitor.
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(payload: FillPayload) {
    if (!form || !session?.id || !session.campaign?.id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('survey_responses').insert({
        form_id: form.id,
        campaign_id: session.campaign.id,
        channel: 'presencial',
        interviewer_id: session.id,
        respondent_name: payload.respondent_name || null,
        age_range: payload.age_range,
        gender: payload.gender,
        religion: payload.religion,
        respondent_phone: payload.respondent_phone || null,
        municipality_code: payload.municipality_code || null,
        neighborhood: payload.neighborhood || null,
        answers: payload.answers,
      });
      if (error) throw new Error(error.message);
      // Não navega: limpa e fica pronto pro próximo eleitor.
      setSavedCount((c) => c + 1);
      setFormKey((k) => k + 1);
      toast.success('Resposta salva! Pronto para o próximo eleitor.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar resposta.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!form) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/campo/aplicar">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Formulário não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/campo/aplicar">
            <ArrowLeft className="h-4 w-4" /> Encerrar
          </Link>
        </Button>
        {savedCount > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {savedCount} resposta{savedCount === 1 ? '' : 's'} nesta sessão
          </span>
        ) : null}
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-primary">Aplicando</p>
        <h2 className="font-display text-2xl leading-tight text-foreground">{form.name}</h2>
        {form.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{form.description}</p>
        ) : null}
        {savedCount > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Preencha o próximo eleitor. Quando terminar, toque em Encerrar.
          </p>
        ) : null}
      </div>

      <SurveyFillForm
        key={formKey}
        form={form}
        questions={questions}
        submitting={submitting}
        onSubmit={(p) => void handleSubmit(p)}
      />
    </div>
  );
}
