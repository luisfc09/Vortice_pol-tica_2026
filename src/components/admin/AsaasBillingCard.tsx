import { useEffect, useState } from 'react';
import {
  CreditCard,
  Save,
  Loader2,
  TestTube2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';

interface PlatformIntegrationSafe {
  key: string;
  is_enabled: boolean;
  environment: 'sandbox' | 'production';
  config: Record<string, unknown>;
  has_secret: boolean;
  secret_keys: string[];
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
}

type Environment = 'sandbox' | 'production';

// Card de configuração do Asaas GLOBAL da Vórtice (cobrança do SaaS).
// Só super admin chega aqui (rota /admin/settings é gated). As credenciais
// ficam na tabela platform_integrations (não em app_settings, que é pública).
export function AsaasBillingCard() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState<Environment>('sandbox');
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_platform_integration_safe', {
      p_key: 'asaas',
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = (data as PlatformIntegrationSafe[] | null)?.[0];
    if (row) {
      setEnabled(row.is_enabled);
      setEnvironment(row.environment);
      setSavedKeys(row.secret_keys ?? []);
      if (row.last_test_ok !== null) {
        setTestResult({
          ok: row.last_test_ok,
          message: row.last_test_message ?? (row.last_test_ok ? 'Conexão OK' : 'Falha'),
        });
      }
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
        body: {
          type: 'asaas',
          secrets: { api_key: apiKey, webhook_secret: webhookSecret },
          config: { environment },
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
    // exige api_key na primeira vez (ou já salva)
    if (!apiKey.trim() && !savedKeys.includes('api_key')) {
      toast.error('Informe a API Key do Asaas.');
      return;
    }
    setSaving(true);
    try {
      // só manda secrets não-vazios (preserva os já salvos via merge no banco)
      const secretsPatch: Record<string, string> = {};
      if (apiKey.trim()) secretsPatch.api_key = apiKey.trim();
      if (webhookSecret.trim()) secretsPatch.webhook_secret = webhookSecret.trim();

      const { error } = await supabase.rpc('update_platform_integration', {
        p_key: 'asaas',
        p_is_enabled: enabled,
        p_environment: environment,
        p_config: {},
        p_secrets_patch: secretsPatch,
        p_last_test_ok: testResult?.ok ?? null,
        p_last_test_message: testResult?.message ?? null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Asaas salvo.');
      setApiKey('');
      setWebhookSecret('');
      void load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-emerald-400" /> Asaas — Cobrança Vórtice
          {enabled && savedKeys.includes('api_key') ? (
            <Badge variant="success" className="ml-1">ativo</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Conta única da Vórtice (gateway de pagamento) para cobrar a mensalidade dos clientes
          do SaaS. Credenciais visíveis apenas ao super admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
              <Checkbox
                id="asaas-enabled"
                checked={enabled}
                onCheckedChange={(c) => setEnabled(c === true)}
              />
              <Label htmlFor="asaas-enabled" className="cursor-pointer">
                Habilitar cobrança via Asaas
              </Label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="asaas-env">Ambiente</Label>
                <Select
                  value={environment}
                  onValueChange={(v) => setEnvironment(v as Environment)}
                >
                  <SelectTrigger id="asaas-env">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="asaas-key">API Key</Label>
                  {savedKeys.includes('api_key') ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> salva
                    </Badge>
                  ) : null}
                </div>
                <Input
                  id="asaas-key"
                  type="password"
                  placeholder={
                    savedKeys.includes('api_key')
                      ? '••••••• (deixe em branco pra manter)'
                      : '$aact_...'
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="asaas-webhook">Webhook secret (opcional)</Label>
                  {savedKeys.includes('webhook_secret') ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> salvo
                    </Badge>
                  ) : null}
                </div>
                <Input
                  id="asaas-webhook"
                  type="password"
                  placeholder={
                    savedKeys.includes('webhook_secret')
                      ? '••••••• (deixe em branco pra manter)'
                      : 'token usado pra validar webhooks do Asaas'
                  }
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
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
              <Button
                type="button"
                className="flex-1"
                onClick={onSave}
                disabled={saving || testing}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando…' : 'Salvar Asaas'}
              </Button>
            </div>

            <a
              href="https://docs.asaas.com/docs/autenticacao"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Onde obter a API Key do Asaas <ExternalLink className="h-3 w-3" />
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}
