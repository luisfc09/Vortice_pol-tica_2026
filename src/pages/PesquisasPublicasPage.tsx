// ============================================================================
// Pesquisas Públicas — lista + criar (migration 050).
// Admin/candidate cria uma pesquisa, sistema gera share_token único (16 hex).
// Depois de criar, redireciona pra /pesquisas/publicas/:id (config completa).
// ============================================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Globe2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { EmptyState } from '@/components/data/EmptyState';
import { usePublicSurveys } from '@/hooks/usePublicSurveys';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { supabase } from '@/lib/supabase';
import type { PublicSurvey } from '@/types';

export default function PesquisasPublicasPage() {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;
  const { surveys, loading, reload } = usePublicSurveys();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [askName, setAskName] = useState(true);
  const [askPhone, setAskPhone] = useState(true);
  const [askLocation, setAskLocation] = useState(true);
  const [allowMultiplePerIp, setAllowMultiplePerIp] = useState(false);

  function resetForm() {
    setTitle('');
    setDescription('');
    setAskName(true);
    setAskPhone(true);
    setAskLocation(true);
    setAllowMultiplePerIp(false);
  }

  async function handleCreate() {
    if (!campaignId) return;
    if (!title.trim()) {
      toast.error('Dê um título para a pesquisa.');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('public_surveys')
        .insert({
          campaign_id: campaignId,
          title: title.trim(),
          description: description.trim() || null,
          ask_name: askName,
          ask_phone: askPhone,
          ask_location: askLocation,
          allow_multiple_per_ip: allowMultiplePerIp,
          is_active: true,
          created_by: session?.id ?? null,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      toast.success('Pesquisa criada. Agora escolha as perguntas.');
      setOpen(false);
      resetForm();
      await reload();
      navigate(`/pesquisas/publicas/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar pesquisa.');
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
          <Globe2 className="h-4 w-4 text-primary" />
          <span className="text-xs uppercase tracking-widest text-primary">Pesquisas</span>
        </div>
        <h2 className="font-display text-3xl tracking-wide text-foreground">
          Pesquisas Públicas
        </h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Crie um formulário público com link único. O eleitor abre pelo celular (WhatsApp),
          responde sozinho e a resposta aparece aqui. As perguntas vêm do banco de perguntas
          regionais.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {surveys.length} pesquisa{surveys.length === 1 ? '' : 's'} criada
          {surveys.length === 1 ? '' : 's'}
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nova pesquisa pública
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : surveys.length === 0 ? (
        <EmptyState
          title="Nenhuma pesquisa pública criada."
          description="Clique em + Nova pesquisa pública para gerar um link que você pode enviar por WhatsApp."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {surveys.map((s) => (
            <SurveyCard key={s.id} survey={s} />
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={(v) => (v ? setOpen(true) : (setOpen(false), resetForm()))}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Nova pesquisa pública</SheetTitle>
            <SheetDescription>
              Depois de criar, você escolhe quais perguntas incluir e recebe o link.
            </SheetDescription>
          </SheetHeader>

          <div className="my-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ps-title">Título</Label>
              <Input
                id="ps-title"
                placeholder="Ex: Diagnóstico da Saúde no Município"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ps-desc">Descrição (opcional)</Label>
              <Textarea
                id="ps-desc"
                placeholder="Aparece no topo do formulário público."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2 rounded-md border border-border/40 p-3">
              <p className="text-sm font-medium">Perguntar ao respondente</p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={askName}
                  onCheckedChange={(v) => setAskName(v === true)}
                />
                Nome (opcional pro eleitor)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={askPhone}
                  onCheckedChange={(v) => setAskPhone(v === true)}
                />
                WhatsApp / telefone (opcional pro eleitor)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={askLocation}
                  onCheckedChange={(v) => setAskLocation(v === true)}
                />
                Município e bairro (opcional pro eleitor)
              </label>
            </div>

            <label className="flex items-start gap-2 rounded-md border border-border/40 p-3 text-sm">
              <Checkbox
                checked={allowMultiplePerIp}
                onCheckedChange={(v) => setAllowMultiplePerIp(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Permitir múltiplas respostas do mesmo dispositivo</span>
                <br />
                <span className="text-xs text-muted-foreground">
                  Marque só se você compartilhar o link em terminal público (biblioteca, UBS).
                  Padrão: 1 resposta por IP.
                </span>
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => (setOpen(false), resetForm())}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? 'Criando…' : 'Criar pesquisa'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SurveyCard({ survey }: { survey: PublicSurvey }) {
  const url = `${window.location.origin}/p/${survey.share_token}`;
  return (
    <Link to={`/pesquisas/publicas/${survey.id}`}>
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-tight">{survey.title}</CardTitle>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                survey.is_active
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {survey.is_active ? 'Ativa' : 'Pausada'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {survey.description ? (
            <p className="line-clamp-2">{survey.description}</p>
          ) : null}
          <p className="text-foreground">
            <span className="font-medium">{survey.response_count}</span> resposta
            {survey.response_count === 1 ? '' : 's'} coletada
            {survey.response_count === 1 ? '' : 's'}
          </p>
          <p className="flex items-center gap-1 truncate text-xs">
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{url}</span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
