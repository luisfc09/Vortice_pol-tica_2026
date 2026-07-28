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
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
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
  const { form, questions, loading, reload } = useSurveyFormDetail(id);
  const {
    members: interviewers,
    loading: interviewersLoading,
    busy: assignBusy,
    toggle: toggleInterviewer,
  } = useFormInterviewers(id);

  const [busy, setBusy] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [questionSheetOpen, setQuestionSheetOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SurveyFormQuestion | null>(null);

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
              <div className="flex shrink-0 gap-1">
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
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4" /> Entrevistadores autorizados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {interviewersLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : interviewers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum membro com acesso a campo nesta campanha. Provisione entrevistadores em
              Usuários (papéis: Pesquisador, Coordenador, Agente de campo).
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Marque quem pode aplicar este formulário em campo.
              </p>
              {interviewers.map((m) => (
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
                  <span className="text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Próximas fases */}
      <Card className="border-dashed">
        <CardContent className="space-y-2 py-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Circle className="h-3.5 w-3.5" /> Publicar como link público para o eleitor (em breve)
          </p>
          <p className="flex items-center gap-2">
            <Circle className="h-3.5 w-3.5" /> Repositório de respostas + exportar (em breve)
          </p>
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
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      {label}
    </label>
  );
}
