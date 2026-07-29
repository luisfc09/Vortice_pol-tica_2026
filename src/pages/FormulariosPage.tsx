// ============================================================================
// FormulariosPage — lista de Formulários de Pesquisa (as "pastas").
// Cada formulário agrupa suas respostas (presencial + público). Admin cria,
// nomeia, e entra no builder pra montar demografia + perguntas.
// (migration 052 — Fase 1)
// ============================================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  FileStack,
  FolderPlus,
  Inbox,
  MessageSquare,
  Pencil,
  Share2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { EmptyState } from '@/components/data/EmptyState';
import { useSurveyForms } from '@/hooks/useSurveyForms';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { supabase } from '@/lib/supabase';
import type { SurveyForm } from '@/types';

export default function FormulariosPage() {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;
  const { forms, loading, reload } = useSurveyForms();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  async function handleCreate() {
    if (!campaignId) return;
    if (!name.trim()) {
      toast.error('Dê um nome ao formulário.');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('survey_forms')
        .insert({
          campaign_id: campaignId,
          name: name.trim(),
          description: description.trim() || null,
          is_active: true,
          // Opcionais começam DESLIGADOS (opt-in) — o admin liga se quiser.
          collect_phone: false,
          collect_municipality: false,
          collect_neighborhood: false,
          created_by: session?.id ?? null,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      toast.success('Formulário criado. Agora monte a demografia e as perguntas.');
      setOpen(false);
      setName('');
      setDescription('');
      await reload();
      navigate(`/pesquisas/formularios/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar formulário.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to="/campo">
          <ArrowLeft className="h-4 w-4" /> Voltar para Pesquisas
        </Link>
      </Button>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <FileStack className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-widest text-primary">Pesquisas</span>
        </div>
        <h2 className="font-display text-3xl tracking-wide text-foreground">
          Formulários de Pesquisa
        </h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Cada formulário é uma pasta: você define a demografia e as perguntas uma vez, e o mesmo
          formulário pode ser aplicado por entrevistadores autorizados e/ou publicado como link
          para o eleitor. Todas as respostas ficam reunidas aqui dentro.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {forms.length} formulário{forms.length === 1 ? '' : 's'}
        </p>
        <Button onClick={() => setOpen(true)}>
          <FolderPlus className="h-4 w-4" /> Novo formulário
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : forms.length === 0 ? (
        <EmptyState
          title="Nenhum formulário de pesquisa ainda."
          description="Clique em Novo formulário para criar o primeiro — demografia + perguntas próprias."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {forms.map((f) => (
            <FormCard key={f.id} form={f} />
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Novo formulário de pesquisa</SheetTitle>
            <SheetDescription>
              Depois de criar, você monta a demografia opcional e adiciona as perguntas.
            </SheetDescription>
          </SheetHeader>

          <div className="my-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="f-name">Nome do formulário</Label>
              <Input
                id="f-name"
                placeholder="Ex: Pesquisa Saúde 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-desc">Descrição (opcional)</Label>
              <Textarea
                id="f-desc"
                placeholder="Do que trata essa pesquisa."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? 'Criando…' : 'Criar formulário'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FormCard({ form }: { form: SurveyForm }) {
  const publicUrl = `${window.location.origin}/f/${form.share_token}`;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base leading-tight">
            <FileStack className="h-4 w-4 shrink-0 text-primary" />
            {form.name}
          </CardTitle>
          <div className="flex shrink-0 gap-1">
            {form.is_public ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                Link ativo
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                form.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted text-muted-foreground'
              }`}
            >
              {form.is_active ? 'Ativo' : 'Pausado'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 text-sm text-muted-foreground">
        {form.description ? <p className="line-clamp-2">{form.description}</p> : null}
        <p className="flex items-center gap-1.5 text-foreground">
          <Users className="h-3.5 w-3.5" />
          <span className="font-medium">{form.response_count}</span> resposta
          {form.response_count === 1 ? '' : 's'} coletada
          {form.response_count === 1 ? '' : 's'}
        </p>
        {/* Ações: 'Ver respostas' em linha cheia (principal) + secundárias
            embaixo, pra o texto nunca vazar do botão em cards estreitos. */}
        <div className="mt-auto space-y-2 pt-1">
          <Button asChild className="w-full">
            <Link to={`/pesquisas/formularios/${form.id}/respostas`}>
              <Inbox className="h-4 w-4" /> Ver respostas ({form.response_count})
            </Link>
          </Button>
          <div className="flex gap-2">
            {form.is_public ? <ShareMenu url={publicUrl} /> : null}
            <Button asChild variant="secondary" className="flex-1">
              <Link to={`/pesquisas/formularios/${form.id}`}>
                <Pencil className="h-4 w-4" /> Editar
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Menu de compartilhar (WhatsApp + Copiar) — previsível no desktop e no
// celular, sem a folha nativa do sistema.
function ShareMenu({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const text = `Ajude nossa campanha respondendo essa pesquisa rápida: ${url}`;

  function whatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    setOpen(false);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    } catch {
      toast.error('Não consegui copiar o link.');
    }
    setOpen(false);
  }

  return (
    <div className="relative flex-1">
      <Button variant="secondary" className="w-full" onClick={() => setOpen((o) => !o)}>
        <Share2 className="h-4 w-4" /> Compartilhar
      </Button>
      {open ? (
        <>
          {/* clique fora fecha */}
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-50 mb-1 w-52 overflow-hidden rounded-md border border-vortex-border bg-vortex-surface shadow-lg">
            <button
              type="button"
              onClick={whatsapp}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-vortex-bg/60"
            >
              <MessageSquare className="h-4 w-4 text-emerald-400" /> Enviar no WhatsApp
            </button>
            <button
              type="button"
              onClick={() => void copy()}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-vortex-bg/60"
            >
              <Copy className="h-4 w-4" /> Copiar link
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
