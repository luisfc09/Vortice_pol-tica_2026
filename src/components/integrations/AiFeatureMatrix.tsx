import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Save, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import {
  AI_FEATURE_HELP,
  AI_FEATURE_LABEL,
  AI_FEATURE_RECOMMENDATION,
  type AiFeature,
  type AiFeatureConfig,
  type IntegrationSafe,
} from '@/types';
import { INTEGRATION_CATALOG, LLM_PROVIDERS, specOf } from '@/data/integration-catalog';

const FEATURES: AiFeature[] = ['mention_sentiment', 'mention_insights', 'reply_suggestions'];

interface RowState {
  integration_id: string | null;
  model: string;
}

interface Props {
  integrations: IntegrationSafe[];
}

export function AiFeatureMatrix({ integrations }: Props) {
  const session = useAuthStore((s) => s.session);
  const [state, setState] = useState<Record<AiFeature, RowState>>(() =>
    Object.fromEntries(
      FEATURES.map((f) => [f, { integration_id: null, model: '' }]),
    ) as Record<AiFeature, RowState>,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const llmIntegrations = useMemo(
    () =>
      integrations.filter(
        (i) => LLM_PROVIDERS.includes(i.type) && i.is_enabled && i.has_secret,
      ),
    [integrations],
  );

  async function load() {
    if (!session?.campaign) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('ai_feature_config')
      .select('*')
      .eq('campaign_id', session.campaign.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = (data ?? []) as AiFeatureConfig[];
    const next = Object.fromEntries(
      FEATURES.map((f) => {
        const found = rows.find((r) => r.feature === f);
        return [
          f,
          {
            integration_id: found?.integration_id ?? null,
            model: found?.model ?? '',
          },
        ];
      }),
    ) as Record<AiFeature, RowState>;
    setState(next);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.campaign?.id]);

  function update(feature: AiFeature, patch: Partial<RowState>) {
    setState((s) => ({ ...s, [feature]: { ...s[feature], ...patch } }));
  }

  async function save() {
    if (!session?.campaign) return;
    setSaving(true);
    try {
      const rows = FEATURES.map((f) => ({
        campaign_id: session.campaign!.id,
        feature: f,
        integration_id: state[f].integration_id,
        model: state[f].model || null,
        options: {},
      }));
      const { error } = await supabase
        .from('ai_feature_config')
        .upsert(rows, { onConflict: 'campaign_id,feature' });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Mapeamento de IA salvo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando mapeamento...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-vortex-border bg-vortex-surface/40 p-4 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-vortex-violet" />
        <div className="text-muted-foreground">
          <p className="text-foreground">Como funciona</p>
          <p>
            Cada feature de IA usa o provedor escolhido aqui. Você pode misturar — por exemplo,
            Claude para sentimento (qualidade) e Gemini para insights (mais barato).
          </p>
        </div>
      </div>

      {llmIntegrations.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Nenhum provedor de IA habilitado.</p>
            <p>
              Vá na aba <strong>Conexões</strong>, configure ao menos um provedor (Anthropic,
              OpenAI ou Gemini), e volte aqui para mapear as features.
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {FEATURES.map((feature) => {
          const row = state[feature];
          const selectedIntegration = row.integration_id
            ? llmIntegrations.find((i) => i.id === row.integration_id)
            : null;
          const spec = selectedIntegration ? specOf(selectedIntegration.type) : null;
          const modelSuggestions = spec?.models ?? [];

          return (
            <div
              key={feature}
              className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur"
            >
              <div className="mb-3">
                <p className="font-semibold text-foreground">{AI_FEATURE_LABEL[feature]}</p>
                <p className="text-xs text-muted-foreground">{AI_FEATURE_HELP[feature]}</p>
                <p className="mt-1 text-[11px] text-vortex-lime/80">
                  ★ Recomendado: {AI_FEATURE_RECOMMENDATION[feature]}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Provedor</Label>
                  <Select
                    value={row.integration_id ?? '__none'}
                    onValueChange={(v) =>
                      update(feature, { integration_id: v === '__none' ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Não configurado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Não configurado —</SelectItem>
                      {llmIntegrations.map((i) => {
                        const s = specOf(i.type);
                        return (
                          <SelectItem key={i.id} value={i.id}>
                            {s?.name ?? i.type}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Modelo</Label>
                  {modelSuggestions.length > 0 ? (
                    <Select
                      value={row.model || '__default'}
                      onValueChange={(v) => update(feature, { model: v === '__default' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Padrão do provedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default">Padrão do provedor</SelectItem>
                        {modelSuggestions.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={row.model}
                      onChange={(e) => update(feature, { model: e.target.value })}
                      placeholder="Padrão do provedor"
                      disabled={!row.integration_id}
                    />
                  )}
                </div>
              </div>

              {selectedIntegration ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="success">Conectado</Badge>
                  {selectedIntegration.last_test_ok === false ? (
                    <span className="text-red-300">
                      Atenção: último teste falhou. Revise as credenciais na aba Conexões.
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || llmIntegrations.length === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando…' : 'Salvar mapeamento'}
        </Button>
      </div>

      <details className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer text-foreground/80">Provedores disponíveis no catálogo</summary>
        <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {INTEGRATION_CATALOG.filter((c) => c.category === 'IA').map((c) => (
            <li key={c.type} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: c.brand }}
              />
              <span>
                {c.name}{' '}
                {c.status === 'soon' ? (
                  <span className="text-amber-300">(em breve)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
