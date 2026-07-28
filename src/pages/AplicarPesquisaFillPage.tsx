// ============================================================================
// AplicarPesquisaFillPage — entrevistador preenche um Formulário de Pesquisa
// (migration 052, Fase 2). Grava em survey_responses (channel='presencial').
// A RLS survey_responses_insert_presencial exige que o user esteja autorizado.
// ============================================================================

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SurveyFillForm, type FillPayload } from '@/components/pesquisas/SurveyFillForm';
import { useSurveyFormDetail } from '@/hooks/useSurveyForms';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { supabase } from '@/lib/supabase';

export default function AplicarPesquisaFillPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = useEffectiveSession();
  const { form, questions, loading } = useSurveyFormDetail(id);
  const [submitting, setSubmitting] = useState(false);

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
      toast.success('Resposta salva!');
      navigate('/campo/aplicar', { replace: true });
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
      <Button asChild variant="ghost" size="sm">
        <Link to="/campo/aplicar">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>

      <div>
        <p className="text-xs uppercase tracking-widest text-primary">Aplicando</p>
        <h2 className="font-display text-2xl leading-tight text-foreground">{form.name}</h2>
        {form.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{form.description}</p>
        ) : null}
      </div>

      <SurveyFillForm
        form={form}
        questions={questions}
        submitting={submitting}
        onSubmit={(p) => void handleSubmit(p)}
      />
    </div>
  );
}
