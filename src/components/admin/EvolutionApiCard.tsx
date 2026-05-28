import { useEffect, useState } from 'react';
import {
  MessageCircle,
  Save,
  Loader2,
  TestTube2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

interface PlatformIntegrationSafe {
  key: string;
  is_enabled: boolean;
  config: { url?: string; instance?: string } | null;
  secret_keys: string[];
}

// Card de config da Evolution API (WhatsApp) GLOBAL da Vórtice — mesmo padrão
// do Asaas (platform_integrations key='evolution'). Só super admin acessa.
export function EvolutionApiCard() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('');
  const [instance, setInstance] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_platform_integration_safe', {
      p_key: 'evolution',
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = (data as PlatformIntegrationSafe[] | null)?.[0];
    if (row) {
      setEnabled(row.is_enabled);
      setUrl(row.config?.url ?? '');
      setInstance(row.config?.instance ?? '');
      setSavedKeys(row.secret_keys ?? []);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: { type: 'evolution', secrets: { api_key: apiKey }, config: { url, instance } },
      });
      if (error) {
        setTestResult({ ok: false, message: error.message });
        return;
      }
      const p = data as { ok?: boolean; message?: string; error?: string };
      setTestResult({ ok: p.ok === true, message: p.error ?? p.message ?? 'Sem detalhes' });
    } finally {
      setTesting(false);
    }
  }

  async function onSave() {
    if (!url.trim() || !instance.trim()) {
      toast.error('Informe a URL e o nome da instância.');
      return;
    }
    if (!apiKey.trim() && !savedKeys.includes('api_key')) {
      toast.error('Informe a API Key da Evolution.');
      return;
    }
    setSaving(true);
    try {
      const secretsPatch: Record<string, string> = {};
      if (apiKey.trim()) secretsPatch.api_key = apiKey.trim();
      const { error } = await supabase.rpc('update_platform_integration', {
        p_key: 'evolution',
        p_is_enabled: enabled,
        p_environment: null,
        p_config: { url: url.trim(), instance: instance.trim() },
        p_secrets_patch: secretsPatch,
        p_last_test_ok: testResult?.ok ?? null,
        p_last_test_message: testResult?.message ?? null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Evolution API salva.');
      setApiKey('');
      void load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-400" /> Evolution API — WhatsApp
          {enabled && savedKeys.includes('api_key') ? (
            <Badge variant="success" className="ml-1">ativo</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Instância Evolution global da Vórtice para envio de WhatsApp (credenciais, avisos de
          vencimento). Configuração visível só ao super admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
              <Checkbox
                id="evo-enabled"
                checked={enabled}
                onCheckedChange={(c) => setEnabled(c === true)}
              />
              <Label htmlFor="evo-enabled" className="cursor-pointer">
                Habilitar envio por WhatsApp
              </Label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="evo-url">URL da instância</Label>
                <Input
                  id="evo-url"
                  placeholder="https://evolution.seudominio.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evo-instance">Nome da instância</Label>
                <Input
                  id="evo-instance"
                  placeholder="vortice"
                  value={instance}
                  onChange={(e) => setInstance(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="evo-key">API Key</Label>
                  {savedKeys.includes('api_key') ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> salva
                    </Badge>
                  ) : null}
                </div>
                <Input
                  id="evo-key"
                  type="password"
                  placeholder={
                    savedKeys.includes('api_key')
                      ? '••••••• (deixe em branco pra manter)'
                      : 'API Key da Evolution'
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            </div>

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

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onTest}
                disabled={testing || saving}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube2 className="h-4 w-4" />
                )}
                {testing ? 'Testando…' : 'Testar conexão'}
              </Button>
              <Button type="button" className="flex-1" onClick={onSave} disabled={saving || testing}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando…' : 'Salvar Evolution'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
