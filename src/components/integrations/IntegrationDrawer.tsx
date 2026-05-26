import { useEffect, useState } from 'react';
import { Save, Loader2, Plug, TestTube2, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import type { IntegrationSafe } from '@/types';
import type { IntegrationSpec } from '@/data/integration-catalog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spec: IntegrationSpec | null;
  integration: IntegrationSafe | null;
  onSaved?: () => void;
}

export function IntegrationDrawer({ open, onOpenChange, spec, integration, onSaved }: Props) {
  const session = useAuthStore((s) => s.session);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!spec) return;
    setSecrets({});
    setTestResult(null);
    if (integration) {
      setEnabled(integration.is_enabled);
      const initialConfig: Record<string, string> = {};
      for (const f of spec.configFields ?? []) {
        const value = (integration.config?.[f.key] ?? '') as string;
        initialConfig[f.key] = String(value);
      }
      setConfig(initialConfig);
    } else {
      setEnabled(false);
      setConfig({});
    }
  }, [spec, integration, open]);

  if (!spec) return null;

  async function onTest() {
    if (!spec) return;
    setTesting(true);
    setTestResult(null);
    try {
      // Para teste, usa as secrets digitadas; se não tem nada novo, pede pro server
      // usar as já guardadas (não retornamos pelo client por segurança).
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: {
          type: spec.type,
          secrets,
          config,
        },
      });
      if (error) {
        setTestResult({ ok: false, message: error.message });
        return;
      }
      const payload = data as { ok?: boolean; message?: string; error?: string };
      if (payload.error) {
        setTestResult({ ok: false, message: payload.error });
        return;
      }
      setTestResult({
        ok: payload.ok === true,
        message: payload.message ?? (payload.ok ? 'Conexão OK' : 'Sem detalhes'),
      });
    } finally {
      setTesting(false);
    }
  }

  async function onSave() {
    if (!session?.campaign || !spec) return;

    // Valida required fields
    for (const f of spec.fields) {
      if (f.required && !secrets[f.key]?.trim() && !integration?.secret_keys.includes(f.key)) {
        toast.error(`${f.label} é obrigatório.`);
        return;
      }
    }

    setSaving(true);
    try {
      // Mescla secrets: se o campo veio vazio E já existia, mantém o antigo via "preserve" flag.
      // Como não temos como ler os secrets pelo client (segurança), usamos um upsert preservando
      // o que já existe usando jsonb_set lado server. Simplificação: se o campo veio vazio
      // mas já existe no DB, removemos do payload para o jsonb_set não sobrescrever.
      const newSecrets: Record<string, string> = {};
      for (const f of spec.fields) {
        if (secrets[f.key]?.trim()) {
          newSecrets[f.key] = secrets[f.key].trim();
        }
      }

      // Busca o registro existente; se for primeira vez, INSERT
      const existing = integration?.id;
      if (existing) {
        // Update: merge secrets via jsonb || (mantém chaves antigas, sobrescreve as novas)
        const { error } = await supabase.rpc('update_integration', {
          p_id: existing,
          p_is_enabled: enabled,
          p_config: config,
          p_secrets_patch: newSecrets,
        });
        if (error) {
          // Fallback: update direto (não preserva secrets antigas)
          const { error: fallbackError } = await supabase
            .from('integrations')
            .update({
              is_enabled: enabled,
              config,
              secrets: { ...(integration.secret_keys.length === 0 ? {} : {}), ...newSecrets },
            })
            .eq('id', existing);
          if (fallbackError) {
            toast.error(fallbackError.message);
            return;
          }
        }
      } else {
        const { error } = await supabase.from('integrations').insert({
          campaign_id: session.campaign.id,
          type: spec.type,
          is_enabled: enabled,
          config,
          secrets: newSecrets,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
      }

      // Persist test result
      if (testResult) {
        await supabase
          .from('integrations')
          .update({
            last_test_at: new Date().toISOString(),
            last_test_ok: testResult.ok,
            last_test_message: testResult.message,
          })
          .eq('campaign_id', session.campaign.id)
          .eq('type', spec.type);
      }

      toast.success('Integração salva.');
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-5">
          <SheetTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            {spec.name}
          </SheetTitle>
          <SheetDescription>{spec.description}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Toggle de ativação */}
          <div className="flex items-center gap-3 rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
            <Checkbox
              id="enabled"
              checked={enabled}
              onCheckedChange={(c) => setEnabled(c === true)}
            />
            <Label htmlFor="enabled" className="cursor-pointer">
              Habilitar integração para a campanha
            </Label>
          </div>

          {/* Credenciais */}
          {spec.fields.length > 0 ? (
            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Credenciais
              </p>
              {spec.fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={f.key}>{f.label}</Label>
                    {integration?.secret_keys.includes(f.key) ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> salvo
                      </Badge>
                    ) : null}
                  </div>
                  <Input
                    id={f.key}
                    type={f.type === 'password' ? 'password' : 'text'}
                    placeholder={
                      integration?.secret_keys.includes(f.key)
                        ? '••••••• (mantém o valor atual se deixar em branco)'
                        : f.placeholder
                    }
                    value={secrets[f.key] ?? ''}
                    onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                  {f.help ? <p className="text-[11px] text-muted-foreground">{f.help}</p> : null}
                </div>
              ))}
            </section>
          ) : null}

          {/* Config */}
          {spec.configFields && spec.configFields.length > 0 ? (
            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Configuração
              </p>
              {spec.configFields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`cfg-${f.key}`}>{f.label}</Label>
                  <Input
                    id={`cfg-${f.key}`}
                    type="text"
                    placeholder={f.placeholder}
                    value={config[f.key] ?? ''}
                    onChange={(e) => setConfig((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                  {f.help ? <p className="text-[11px] text-muted-foreground">{f.help}</p> : null}
                </div>
              ))}
            </section>
          ) : null}

          {/* Result do teste */}
          {testResult ? (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                testResult.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          ) : null}

          {/* Ações */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onTest}
              disabled={testing || saving}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
              {testing ? 'Testando…' : 'Testar conexão'}
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={onSave}
              disabled={saving || testing}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>

          {spec.docsUrl ? (
            <a
              href={spec.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Onde obter as credenciais <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
