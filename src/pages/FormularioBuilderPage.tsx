// ============================================================================
// FormularioBuilderPage — monta um Formulário de Pesquisa (migration 052, Fase 1).
// Seções:
//   1. Cabeçalho: nome/descrição/ativo (edição inline)
//   2. Demografia: fixa (nome/faixa/sexo/religião) + opcionais (tel/mun/bairro)
//   3. Perguntas: CRUD + reordenar (reusa QuestionForm)
// Autorizar entrevistadores (Fase 2), publicar link (Fase 3) e repositório de
// respostas (Fase 4) entram nas próximas fases — aqui aparecem como próximos passos.
// ============================================================================

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe2,
  Inbox,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  QuestionForm,
  type QuestionFormValues,
} from '@/components/pesquisas/QuestionForm';
import { InviteInterviewerSheet } from '@/components/pesquisas/InviteInterviewerSheet';
import { useSurveyFormDetail } from '@/hooks/useSurveyForms';
import { useFormInterviewers } from '@/hooks/useFormInterviewers';
import { supabase } from '@/lib/supabase';
import { CAMPAIGN_QUESTION_TYPE_LABEL, ROLE_LABEL, type SurveyFormQuestion } from '@/types';

const FIXED_DEMOGRAPHICS = [
  'Nome do eleitor',
  'Faixa etária',
  'Sexo',
  'Religião',
];

export default function FormularioBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { form, questions, loading, reload } = useSurveyFormDetail(id);
  const {
    members: interviewers,
    loading: interviewersLoading,
    busy: assignBusy,
    toggle: toggleInterviewer,
    markAll: markAllInterviewers,
    clearAll: clearAllInterviewers,
    reload: reloadInterviewers,
  } = useFormInterviewers(id);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [interviewerSearch, setInterviewerSearch] = useState('');

  const assignedCount = useMemo(
    () => interviewers.filter((m) => m.assigned).length,
    [interviewers],
  );
  const filteredInterviewers = useMemo(() => {
    const q = interviewerSearch.trim().toLowerCase();
    if (!q) return interviewers;
    return interviewers.filter((m) => m.full_name.toLowerCase().includes(q));
  }, [interviewers, interviewerSearch]);

  const [busy, setBusy] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [questionSheetOpen, setQuestionSheetOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SurveyFormQuestion | null>(null);
  const [copied, setCopied] = useState(false);

  const publicUrl = form ? `${window.location.origin}/f/${form.share_token}` : '';

  const orderedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.position - b.position),
    [questions],
  );

  function startEditHeader() {
    if (!form) return;
    setName(form.name);
    setDescription(form.description ?? '');
    setEditingHeader(true);
  }

  async function saveHeader() {
    if (!form) return;
    if (!name.trim()) {
      toast.error('O nome não pode ficar vazio.');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('survey_forms')
      .update({ name: name.trim(), description: description.trim() || null })
      .eq('id', form.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditingHeader(false);
    await reload();
  }

  async function toggleActive() {
    if (!form) return;
    setBusy(true);
    const { error } = await supabase
      .from('survey_forms')
      .update({ is_active: !form.is_active })
      .eq('id', form.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else await reload();
  }

  async function toggleDemographic(
    field: 'collect_phone' | 'collect_municipality' | 'collect_neighborhood',
  ) {
    if (!form) return;
    setBusy(true);
    const { error } = await supabase
      .from('survey_forms')
      .update({ [field]: !form[field] })
      .eq('id', form.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else await reload();
  }

  function openNewQuestion() {
    setEditingQuestion(null);
    setQuestionSheetOpen(true);
  }

  function openEditQuestion(q: SurveyFormQuestion) {
    setEditingQuestion(q);
    setQuestionSheetOpen(true);
  }

  async function saveQuestion(values: QuestionFormValues) {
    if (!form) return;
    setBusy(true);
    try {
      if (editingQuestion) {
        const { error } = await supabase
          .from('survey_form_questions')
          .update({
            text: values.text,
            type: values.type,
            options: values.options,
            is_required: values.is_required,
          })
          .eq('id', editingQuestion.id);
        if (error) throw new Error(error.message);
        toast.success('Pergunta atualizada.');
      } else {
        const nextPos =
          orderedQuestions.length === 0
            ? 0
            : Math.max(...orderedQuestions.map((q) => q.position)) + 1;
        const { error } = await supabase.from('survey_form_questions').insert({
          form_id: form.id,
          text: values.text,
          type: values.type,
          options: values.options,
          is_required: values.is_required,
          position: nextPos,
        });
        if (error) throw new Error(error.message);
        toast.success('Pergunta adicionada.');
      }
      setQuestionSheetOpen(false);
      setEditingQuestion(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar pergunta.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePublic() {
    if (!form) return;
    setBusy(true);
    const { error } = await supabase
      .from('survey_forms')
      .update({ is_public: !form.is_public })
      .eq('id', form.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.is_public ? 'Link despublicado.' : 'Link publicado!');
    await reload();
  }

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function shareOnWhatsApp() {
    if (!form) return;
    const text = encodeURIComponent(
      `Ajude nossa campanha respondendo essa pesquisa rápida: ${publicUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
  }

  async function deleteForm() {
    if (!form) return;
    // Cascata: apagar o formulário leva perguntas, autorizações E respostas.
    const msg =
      form.response_count > 0
        ? `Excluir o formulário "${form.name}"? As ${form.response_count} resposta(s) coletada(s), as perguntas e as autorizações serão APAGADAS. Essa ação NÃO tem volta.`
        : `Excluir o formulário "${form.name}"? Essa ação NÃO tem volta.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    const { error } = await supabase.from('survey_forms').delete().eq('id', form.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Formulário excluído.');
    navigate('/pesquisas/formularios', { replace: true });
  }

  async function removeQuestion(q: SurveyFormQuestion) {
    if (!window.confirm(`Excluir a pergunta "${q.text}"?`)) return;
    setBusy(true);
    const { error } = await supabase.from('survey_form_questions').delete().eq('id', q.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else await reload();
  }

  async function moveQuestion(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= orderedQuestions.length) return;
    const a = orderedQuestions[index];
    const b = orderedQuestions[target];
    setBusy(true);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('survey_form_questions').update({ position: b.position }).eq('id', a.id),
      supabase.from('survey_form_questions').update({ position: a.position }).eq('id', b.id),
    ]);
    setBusy(false);
    if (e1 || e2) toast.error(e1?.message ?? e2?.message ?? 'Falha ao reordenar.');
    else await reload();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!form) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/pesquisas/formularios">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Formulário não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/pesquisas/formularios">
            <ArrowLeft className="h-4 w-4" /> Voltar para Formulários
          </Link>
        </Button>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Salvo automaticamente
        </span>
      </div>

      {/* 1. Cabeçalho */}
      <Card>
        <CardContent className="pt-6">
          {editingHeader ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Descrição</Label>
                <Textarea
                  id="edit-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingHeader(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => void saveHeader()} disabled={busy}>
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl tracking-wide text-foreground">
                  {form.name}
                </h2>
                {form.description ? (
                  <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                    {form.description}
                  </p>
                ) : null}
                <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
                  {form.response_count} resposta{form.response_count === 1 ? '' : 's'} ·{' '}
                  {form.is_active ? 'Ativo' : 'Pausado'}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                <Button asChild variant="default" size="sm">
                  <Link to={`/pesquisas/formularios/${form.id}/respostas`}>
                    <Inbox className="h-3.5 w-3.5" /> Ver respostas ({form.response_count})
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={startEditHeader}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void toggleActive()}>
                  {form.is_active ? 'Pausar' : 'Reativar'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Demografia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demografia do eleitor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Sempre coletados
            </p>
            <div className="flex flex-wrap gap-2">
              {FIXED_DEMOGRAPHICS.map((d) => (
                <span
                  key={d}
                  className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-sm text-foreground"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Opcionais — ligue se quiser coletar
            </p>
            <div className="space-y-2">
              <DemographicToggle
                label="Telefone / WhatsApp"
                checked={form.collect_phone}
                onToggle={() => void toggleDemographic('collect_phone')}
              />
              <DemographicToggle
                label="Município"
                checked={form.collect_municipality}
                onToggle={() => void toggleDemographic('collect_municipality')}
              />
              <DemographicToggle
                label="Bairro"
                checked={form.collect_neighborhood}
                onToggle={() => void toggleDemographic('collect_neighborhood')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Perguntas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Perguntas ({orderedQuestions.length})
            </CardTitle>
            <Button size="sm" onClick={openNewQuestion}>
              <Plus className="h-4 w-4" /> Nova pergunta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {orderedQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma pergunta ainda. Clique em Nova pergunta para começar.
            </p>
          ) : (
            <div className="space-y-2">
              {orderedQuestions.map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/40 p-3 text-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {i + 1}.
                      </span>
                      <div>
                        <p className="text-foreground">{q.text}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {CAMPAIGN_QUESTION_TYPE_LABEL[q.type]}
                          {q.is_required ? ' · obrigatória' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy || i === 0}
                      onClick={() => void moveQuestion(i, -1)}
                      aria-label="Subir"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy || i === orderedQuestions.length - 1}
                      onClick={() => void moveQuestion(i, 1)}
                      aria-label="Descer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditQuestion(q)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void removeQuestion(q)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Entrevistadores autorizados */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4" /> Entrevistadores autorizados
            </CardTitle>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <Plus className="h-4 w-4" /> Convidar entrevistador
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {interviewersLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : interviewers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum membro elegível nesta campanha ainda. Use “Convidar entrevistador” acima
              pra criar o primeiro.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {assignedCount} de {interviewers.length} autorizado
                  {assignedCount === 1 ? '' : 's'}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void markAllInterviewers()}
                    disabled={assignBusy || assignedCount === interviewers.length}
                  >
                    Marcar todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void clearAllInterviewers()}
                    disabled={assignBusy || assignedCount === 0}
                  >
                    Limpar
                  </Button>
                </div>
              </div>

              <Input
                value={interviewerSearch}
                onChange={(e) => setInterviewerSearch(e.target.value)}
                placeholder="Buscar por nome…"
                className="h-9"
              />

              {filteredInterviewers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum nome encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {filteredInterviewers.map((m) => (
                    <label
                      key={m.user_id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-2.5 text-sm ${
                        m.assigned ? 'border-primary/40 bg-primary/5' : 'border-border/40'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Checkbox
                          checked={m.assigned}
                          disabled={assignBusy}
                          onCheckedChange={() => void toggleInterviewer(m)}
                        />
                        <span className="text-foreground">{m.full_name}</span>
                        {!m.is_active ? (
                          <span className="text-xs text-muted-foreground">(inativo)</span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_LABEL[m.role]}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Publicar como link público */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 className="h-4 w-4" /> Link público (eleitor responde sozinho)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.is_public ? (
            <>
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5 text-sm">
                <span className="flex items-center gap-1.5 text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Link ativo
                </span>
              </div>
              <div className="space-y-2">
                <Label>Link</Label>
                <div className="flex flex-wrap gap-2">
                  <Input value={publicUrl} readOnly className="min-w-0 flex-1 font-mono text-xs" />
                  <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
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
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={shareOnWhatsApp}>
                  <MessageSquare className="h-4 w-4" /> Enviar via WhatsApp
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void togglePublic()} disabled={busy}>
                  Despublicar
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Publique pra gerar um link que o eleitor abre no celular e responde sozinho, sem
                entrevistador. As respostas caem no mesmo repositório deste formulário.
              </p>
              <Button onClick={() => void togglePublic()} disabled={busy}>
                <Globe2 className="h-4 w-4" /> Publicar link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zona de perigo */}
      <Card className="border-destructive/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="text-sm">
            <p className="font-medium text-foreground">Excluir formulário</p>
            <p className="text-muted-foreground">
              Apaga o formulário, as perguntas, as autorizações e todas as respostas
              coletadas. Sem volta.
            </p>
          </div>
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void deleteForm()}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" /> Excluir formulário
          </Button>
        </CardContent>
      </Card>

      <QuestionForm
        open={questionSheetOpen}
        onOpenChange={(o) => {
          setQuestionSheetOpen(o);
          if (!o) setEditingQuestion(null);
        }}
        initial={editingQuestion}
        saving={busy}
        onSave={saveQuestion}
        title={editingQuestion ? 'Editar pergunta' : 'Nova pergunta do formulário'}
        description="Aparece na pesquisa aplicada pelo entrevistador e/ou no link público."
      />

      <InviteInterviewerSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        formId={form.id}
        campaignId={form.campaign_id}
        onInvited={() => void reloadInterviewers()}
      />
    </div>
  );
}

function DemographicToggle({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2 text-sm">
      <span className="text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${checked ? 'Desativar' : 'Ativar'} ${label}`}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
