// ============================================================================
// Detalhe de uma Pesquisa Pública — configura perguntas, gera link/QR/wa.me,
// lista respostas. Migração 050.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  Pause,
  Play,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useCampaignQuestions } from '@/hooks/useCampaignQuestions';
import { usePublicSurveyDetail } from '@/hooks/usePublicSurveys';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { CAMPAIGN_QUESTION_TYPE_LABEL, type PublicSurveyResponse } from '@/types';

export default function PesquisaPublicaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const session = useEffectiveSession();
  const { survey, questionLinks, loading, reload } = usePublicSurveyDetail(id);
  const { questions: bankQuestions } = useCampaignQuestions({ activeOnly: false });

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [waMessage, setWaMessage] = useState('');
  const [responses, setResponses] = useState<PublicSurveyResponse[]>([]);

  const publicUrl = useMemo(
    () => (survey ? `${window.location.origin}/p/${survey.share_token}` : ''),
    [survey],
  );

  const linkedIds = useMemo(
    () => new Set(questionLinks.map((l) => l.question_id)),
    [questionLinks],
  );

  useEffect(() => {
    if (survey?.title && !waMessage) {
      const candidateName = session?.campaign?.candidate_name ?? 'a nossa campanha';
      setWaMessage(
        `Olá! Estamos ouvindo eleitores sobre "${survey.title}" para ${candidateName}. ` +
          `Leva 1 minuto: ${publicUrl}`,
      );
    }
  }, [survey?.title, publicUrl, waMessage, session?.campaign?.candidate_name]);

  // Carrega respostas separado (podem ser muitas).
  const loadResponses = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('public_survey_responses')
      .select('*')
      .eq('survey_id', id)
      .order('submitted_at', { ascending: false })
      .limit(200);
    if (error) {
      console.warn('loadResponses:', error.message);
      return;
    }
    setResponses((data ?? []) as PublicSurveyResponse[]);
  }, [id]);

  useEffect(() => {
    void loadResponses();
  }, [loadResponses]);

  async function toggleActive() {
    if (!survey) return;
    setBusy(true);
    const { error } = await supabase
      .from('public_surveys')
      .update({ is_active: !survey.is_active })
      .eq('id', survey.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(survey.is_active ? 'Pesquisa pausada.' : 'Pesquisa reativada.');
    await reload();
  }

  async function toggleQuestion(questionId: string, currentlyLinked: boolean) {
    if (!survey) return;
    setBusy(true);
    try {
      if (currentlyLinked) {
        const link = questionLinks.find((l) => l.question_id === questionId);
        if (!link) return;
        const { error } = await supabase
          .from('public_survey_questions')
          .delete()
          .eq('id', link.id);
        if (error) throw new Error(error.message);
      } else {
        const nextPos =
          questionLinks.length === 0
            ? 0
            : Math.max(...questionLinks.map((l) => l.position)) + 1;
        const { error } = await supabase.from('public_survey_questions').insert({
          survey_id: survey.id,
          question_id: questionId,
          position: nextPos,
          is_required: false,
        });
        if (error) throw new Error(error.message);
      }
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao vincular pergunta.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleRequired(linkId: string, current: boolean) {
    setBusy(true);
    const { error } = await supabase
      .from('public_survey_questions')
      .update({ is_required: !current })
      .eq('id', linkId);
    setBusy(false);
    if (error) toast.error(error.message);
    else await reload();
  }

  async function deleteSurvey() {
    if (!survey) return;
    if (
      !window.confirm(
        `Excluir a pesquisa "${survey.title}"? Todas as ${survey.response_count} respostas serão perdidas. Essa ação NÃO tem volta.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('public_surveys').delete().eq('id', survey.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Pesquisa excluída.');
    window.location.href = '/pesquisas/publicas';
  }

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function shareOnWhatsApp() {
    const text = encodeURIComponent(waMessage);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }
  if (!survey) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/pesquisas/publicas">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Pesquisa não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to="/pesquisas/publicas">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-foreground">
            {survey.title}
          </h2>
          {survey.description ? (
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              {survey.description}
            </p>
          ) : null}
          <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
            {survey.response_count} resposta{survey.response_count === 1 ? '' : 's'} · Criada em{' '}
            {new Date(survey.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void toggleActive()} disabled={busy}>
            {survey.is_active ? (
              <>
                <Pause className="h-4 w-4" /> Pausar
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Reativar
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => void deleteSurvey()}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      {/* Compartilhamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compartilhar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Link público</Label>
            <div className="flex gap-2">
              <Input value={publicUrl} readOnly className="font-mono text-xs" />
              <Button variant="secondary" onClick={() => void copyLink()}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copiar
                  </>
                )}
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Abrir
                </a>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wa-msg">Mensagem para WhatsApp</Label>
            <Textarea
              id="wa-msg"
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              rows={3}
            />
            <Button onClick={shareOnWhatsApp}>
              <MessageSquare className="h-4 w-4" /> Enviar via WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Perguntas incluídas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Perguntas ({linkedIds.size})</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/pesquisas/perguntas-regionais">Gerenciar banco de perguntas</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {bankQuestions.filter((q) => q.is_active).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma pergunta ativa no banco. Vá em{' '}
              <Link
                to="/pesquisas/perguntas-regionais"
                className="text-primary underline underline-offset-4"
              >
                Perguntas Regionais
              </Link>{' '}
              para cadastrar.
            </p>
          ) : (
            <div className="space-y-2">
              {bankQuestions
                .filter((q) => q.is_active)
                .map((q) => {
                  const linked = linkedIds.has(q.id);
                  const link = questionLinks.find((l) => l.question_id === q.id);
                  return (
                    <div
                      key={q.id}
                      className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${
                        linked ? 'border-primary/40 bg-primary/5' : 'border-border/40'
                      }`}
                    >
                      <label className="flex flex-1 items-start gap-3">
                        <Checkbox
                          checked={linked}
                          onCheckedChange={() => void toggleQuestion(q.id, linked)}
                          disabled={busy}
                        />
                        <div className="flex-1">
                          <p className="text-foreground">{q.text}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {CAMPAIGN_QUESTION_TYPE_LABEL[q.type]}
                          </p>
                        </div>
                      </label>
                      {linked && link ? (
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Checkbox
                            checked={link.is_required}
                            onCheckedChange={() =>
                              void toggleRequired(link.id, link.is_required)
                            }
                          />
                          Obrigatória
                        </label>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Respostas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Respostas ({responses.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há respostas.</p>
          ) : (
            <div className="space-y-3">
              {responses.map((r) => (
                <div
                  key={r.id}
                  className="rounded-md border border-border/40 p-3 text-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {r.respondent_name || 'Anônimo'}
                      {r.respondent_phone ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {r.respondent_phone}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.submitted_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {r.neighborhood || r.municipality_code ? (
                    <p className="text-xs text-muted-foreground">
                      {[r.neighborhood, r.municipality_code].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                  <div className="mt-2 space-y-1">
                    {Object.entries(r.answers ?? {}).map(([qid, val]) => {
                      const link = questionLinks.find((l) => l.id === qid);
                      const label =
                        (link && bankQuestions.find((q) => q.id === link.question_id)?.text) ||
                        'Pergunta';
                      return (
                        <div key={qid} className="text-xs">
                          <span className="text-muted-foreground">{label}: </span>
                          <span className="text-foreground">
                            {Array.isArray(val) ? val.join(', ') : String(val ?? '—')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
