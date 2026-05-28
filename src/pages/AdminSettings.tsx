import { useEffect, useState } from 'react';
import {
  Shield,
  Save,
  Building2,
  Mail,
  Sparkles,
  FileText,
  Globe2,
  SlidersHorizontal,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { AsaasBillingCard } from '@/components/admin/AsaasBillingCard';
import { EvolutionApiCard } from '@/components/admin/EvolutionApiCard';
import { AsaasWebhookLogs } from '@/components/admin/AsaasWebhookLogs';
import type { AppSettings } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSettings(data as AppSettings);
  }

  useEffect(() => {
    void load();
  }, []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({
        product_name: settings.product_name,
        product_slogan: settings.product_slogan,
        support_email: settings.support_email,
        default_vote_target: settings.default_vote_target,
        default_trial_days: settings.default_trial_days,
        default_state: settings.default_state,
        terms_url: settings.terms_url,
        privacy_url: settings.privacy_url,
      })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Configurações salvas.');
    void load();
  }

  if (loading || !settings) {
    return <p className="text-sm text-muted-foreground">Carregando configurações...</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Shield className="h-4 w-4 text-vortex-violet" />
          <span className="text-xs uppercase tracking-widest text-vortex-violet">
            Admin Vórtice
          </span>
        </div>
        <h2 className="font-display text-3xl tracking-wide text-foreground">
          Configurações do software
        </h2>
        <p className="text-sm text-muted-foreground">
          Valores aplicados a todas as campanhas. Última atualização:{' '}
          {format(new Date(settings.updated_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
            locale: ptBR,
          })}
          .
        </p>
      </div>

      <Tabs defaultValue="plataforma" className="space-y-5">
        <TabsList>
          <TabsTrigger value="plataforma" className="gap-1.5">
            <SlidersHorizontal className="h-4 w-4" /> Plataforma
          </TabsTrigger>
          <TabsTrigger value="cobranca" className="gap-1.5">
            <CreditCard className="h-4 w-4" /> Cobrança & Notificações
          </TabsTrigger>
        </TabsList>

        {/* ----------------------------------------------------------------- */}
        {/* Submódulo: Plataforma (app_settings) */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="plataforma" className="space-y-5">
          <form onSubmit={save} className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Branding
                </CardTitle>
                <CardDescription>
                  Nome e slogan exibidos no login e em e-mails transacionais.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="product_name">Nome do produto</Label>
                  <Input
                    id="product_name"
                    value={settings.product_name}
                    onChange={(e) => update('product_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="product_slogan">Slogan</Label>
                  <Input
                    id="product_slogan"
                    value={settings.product_slogan}
                    onChange={(e) => update('product_slogan', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-vortex-violet" /> Defaults de novas campanhas
                </CardTitle>
                <CardDescription>
                  Valores pré-preenchidos quando você provisiona uma nova campanha.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="default_vote_target">Meta de votos padrão</Label>
                  <Input
                    id="default_vote_target"
                    inputMode="numeric"
                    value={String(settings.default_vote_target)}
                    onChange={(e) =>
                      update('default_vote_target', Number(e.target.value.replace(/\D/g, '')) || 0)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_trial_days">Dias de trial</Label>
                  <Input
                    id="default_trial_days"
                    inputMode="numeric"
                    value={String(settings.default_trial_days)}
                    onChange={(e) =>
                      update('default_trial_days', Number(e.target.value.replace(/\D/g, '')) || 0)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_state">UF padrão</Label>
                  <Input
                    id="default_state"
                    maxLength={2}
                    value={settings.default_state}
                    onChange={(e) => update('default_state', e.target.value.toUpperCase().slice(0, 2))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-amber-400" /> Suporte
                </CardTitle>
                <CardDescription>
                  E-mail e links exibidos para clientes em caso de problema.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="support_email">E-mail de suporte</Label>
                  <Input
                    id="support_email"
                    type="email"
                    value={settings.support_email}
                    onChange={(e) => update('support_email', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-400" /> Termos & Privacidade
                </CardTitle>
                <CardDescription>
                  URLs dos documentos legais — apresentados no rodapé do login.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="terms_url">Termos de uso (URL)</Label>
                  <Input
                    id="terms_url"
                    type="url"
                    placeholder="https://vortice.app/termos"
                    value={settings.terms_url ?? ''}
                    onChange={(e) => update('terms_url', e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="privacy_url">Política de privacidade (URL)</Label>
                  <Input
                    id="privacy_url"
                    type="url"
                    placeholder="https://vortice.app/privacidade"
                    value={settings.privacy_url ?? ''}
                    onChange={(e) => update('privacy_url', e.target.value || null)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-emerald-400" /> Informações técnicas
                </CardTitle>
                <CardDescription>Somente leitura — referência rápida.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <InfoRow label="URL do projeto Supabase" value={import.meta.env.VITE_SUPABASE_URL} mono />
                <InfoRow label="Modo" value="Produção" />
                <InfoRow label="Versão do app" value="0.1.0" />
                <InfoRow label="Ambiente do front" value={window.location.origin} mono />
              </CardContent>
            </Card>

            <div className="sticky bottom-4 z-10 flex justify-end">
              <Button type="submit" size="lg" disabled={saving} className="shadow-xl">
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar configurações'}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ----------------------------------------------------------------- */}
        {/* Submódulo: Cobrança & Notificações (Asaas + Evolution + logs) */}
        {/* ----------------------------------------------------------------- */}
        <TabsContent value="cobranca" className="space-y-5">
          {/* Cobrança Asaas — config global da Vórtice (fora do form de app_settings) */}
          <AsaasBillingCard />

          {/* Evolution API (WhatsApp) — config global da Vórtice */}
          <EvolutionApiCard />

          {/* Logs de webhook do Asaas (ativação/suspensão automática) */}
          <AsaasWebhookLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-foreground/90 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
