import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ListChecks, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/data/EmptyState';
import { QuestionCard } from '@/components/pesquisas/QuestionCard';
import { QuestionForm, type QuestionFormValues } from '@/components/pesquisas/QuestionForm';
import { useCampaignQuestions } from '@/hooks/useCampaignQuestions';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { supabase } from '@/lib/supabase';
import type { CampaignQuestion } from '@/types';

export default function PerguntasRegionaisPage() {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;
  // activeOnly:false → lista inclui inativas (gestão).
  const { questions, loading, reload } = useCampaignQuestions({ activeOnly: false });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignQuestion | null>(null);
  const [busy, setBusy] = useState(false);

  const activeCount = useMemo(() => questions.filter((q) => q.is_active).length, [questions]);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(q: CampaignQuestion) {
    setEditing(q);
    setFormOpen(true);
  }

  async function handleSave(values: QuestionFormValues) {
    if (!campaignId) return;
    setBusy(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('campaign_questions')
          .update({
            text: values.text,
            type: values.type,
            options: values.options,
            is_required: values.is_required,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editing.id);
        if (error) throw new Error(error.message);
        toast.success('Pergunta atualizada.');
      } else {
        const maxOrder = questions.reduce((m, q) => Math.max(m, q.sort_order), 0);
        const { error } = await supabase.from('campaign_questions').insert({
          campaign_id: campaignId,
          text: values.text,
          type: values.type,
          options: values.options,
          is_required: values.is_required,
          sort_order: maxOrder + 1,
          is_active: true,
          created_by: session?.id ?? null,
        });
        if (error) throw new Error(error.message);
        toast.success('Pergunta criada.');
      }
      setFormOpen(false);
      setEditing(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(q: CampaignQuestion) {
    setBusy(true);
    try {
      const { error } = await supabase
        .from('campaign_questions')
        .update({ is_active: !q.is_active, updated_at: new Date().toISOString() })
        .eq('id', q.id);
      if (error) throw new Error(error.message);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao atualizar.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(q: CampaignQuestion) {
    if (
      !window.confirm(
        `Excluir a pergunta "${q.text}"? As respostas já coletadas dela também serão removidas.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('campaign_questions').delete().eq('id', q.id);
      if (error) throw new Error(error.message);
      toast.success('Pergunta excluída.');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir.');
    } finally {
      setBusy(false);
    }
  }

  // Reordena trocando o sort_order com o vizinho (↑ ↓).
  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    const a = questions[index];
    const b = questions[target];
    setBusy(true);
    try {
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('campaign_questions').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('campaign_questions').update({ sort_order: a.sort_order }).eq('id', b.id),
      ]);
      if (e1 || e2) throw new Error(e1?.message ?? e2?.message);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao reordenar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to="/campo">
          <ArrowLeft className="h-4 w-4" /> Voltar para Pesquisas
        </Link>
      </Button>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-widest text-primary">Pesquisas</span>
        </div>
        <h2 className="font-display text-3xl tracking-wide text-foreground">
          Perguntas Regionais da Campanha
        </h2>
        <p className="text-sm text-muted-foreground">
          {session?.campaign?.candidate_name}
          {session?.campaign?.party ? ` · ${session.campaign.party}` : ''}
        </p>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Essas perguntas aparecem como bloco final de cada entrevista de campo desta campanha.
          As perguntas padrão não são afetadas.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {activeCount} pergunta{activeCount === 1 ? '' : 's'} ativa{activeCount === 1 ? '' : 's'}
        </p>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Nova pergunta
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : questions.length === 0 ? (
        <EmptyState
          title="Nenhuma pergunta regional cadastrada."
          description="Clique em + Nova pergunta para começar. Elas aparecem no final da entrevista de campo."
        />
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              isFirst={i === 0}
              isLast={i === questions.length - 1}
              busy={busy}
              onEdit={() => openEdit(q)}
              onToggleActive={() => void toggleActive(q)}
              onDelete={() => void remove(q)}
              onMoveUp={() => void move(i, -1)}
              onMoveDown={() => void move(i, 1)}
            />
          ))}
        </div>
      )}

      <QuestionForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        saving={busy}
        onSave={handleSave}
      />
    </div>
  );
}
