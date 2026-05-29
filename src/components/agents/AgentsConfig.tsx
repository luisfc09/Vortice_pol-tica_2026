import { useEffect, useState } from 'react';
import { Loader2, Save, AlertTriangle, Brain, MessageCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { supabase } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { cn } from '@/lib/utils';
import type { AiAgent, AgentKey, IntegrationSafe } from '@/types';

interface Props {
  integrations: IntegrationSafe[];
}

type ProviderChoice = 'anthropic' | 'openai' | 'auto';

interface AgentMeta {
  key: AgentKey;
  defaultName: string;
  subtitle: string;
  Icon: typeof Brain;
}

const AGENTS: AgentMeta[] = [
  { key: 'steve', defaultName: 'Steve_AI', subtitle: 'Estrategista Político', Icon: Brain },
  { key: 'carlos', defaultName: 'Carlos_AI_Op', subtitle: 'Assistente Operacional', Icon: MessageCircle },
];

interface AgentForm {
  name: string;
  avatar_url: string;
  is_active: boolean;
  provider: ProviderChoice;
}

function emptyForm(meta: AgentMeta): AgentForm {
  return { name: meta.defaultName, avatar_url: '', is_active: true, provider: 'auto' };
}

// Aba "Agentes de IA" em /integracoes: configura nome, foto e LLM de Steve e Carlos.
export function AgentsConfig({ integrations }: Props) {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<AgentKey | null>(null);
  const [forms, setForms] = useState<Record<AgentKey, AgentForm>>({
    steve: emptyForm(AGENTS[0]),
    carlos: emptyForm(AGENTS[1]),
  });

  const anthropicReady = integrations.some(
    (i) => i.type === 'anthropic' && i.is_enabled && i.has_secret,
  );
  const openaiReady = integrations.some(
    (i) => i.type === 'openai' && i.is_enabled && i.has_secret,
  );
  const noneReady = !anthropicReady && !openaiReady;

  useEffect(() => {
    if (!campaignId) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('campaign_id', campaignId);
      if (!active) return;
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      const rows = (data ?? []) as AiAgent[];
      setForms(() => {
        const next = {} as Record<AgentKey, AgentForm>;
        for (const meta of AGENTS) {
          const row = rows.find((r) => r.agent_key === meta.key);
          next[meta.key] = row
            ? {
                name: row.name || meta.defaultName,
                avatar_url: row.avatar_url ?? '',
                is_active: row.is_active,
                provider: (row.llm_provider ?? 'auto') as ProviderChoice,
              }
            : emptyForm(meta);
        }
        return next;
      });
    })();
    return () => {
      active = false;
    };
  }, [campaignId]);

  function patch(key: AgentKey, p: Partial<AgentForm>) {
    setForms((f) => ({ ...f, [key]: { ...f[key], ...p } }));
  }

  async function save(key: AgentKey) {
    if (!campaignId) {
      toast.error('Entre em uma campanha para configurar os agentes.');
      return;
    }
    const form = forms[key];
    if (!form.name.trim()) {
      toast.error('Informe o nome do agente.');
      return;
    }
    setSaving(key);
    const { error } = await supabase.from('ai_agents').upsert(
      {
        campaign_id: campaignId,
        agent_key: key,
        name: form.name.trim(),
        avatar_url: form.avatar_url.trim() || null,
        is_active: form.is_active,
        llm_provider: form.provider === 'auto' ? null : form.provider,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'campaign_id,agent_key' },
    );
    setSaving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Configuração do agente salva.');
  }

  if (!campaignId) {
    return (
      <p className="text-sm text-muted-foreground">
        Entre em uma campanha para configurar os agentes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {noneReady ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Configure pelo menos uma integração de IA (Anthropic ou OpenAI) na aba{' '}
            <strong>Conexões</strong> para ativar os agentes.
          </span>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando agentes…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {AGENTS.map((meta) => {
            const form = forms[meta.key];
            return (
              <div
                key={meta.key}
                className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-4 backdrop-blur"
              >
                <div className="mb-4 flex items-start gap-3">
                  <AgentAvatar url={form.avatar_url} name={form.name} size={64} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-foreground">
                        {form.name || meta.defaultName}
                      </p>
                      <ActiveToggle
                        active={form.is_active}
                        onChange={(v) => patch(meta.key, { is_active: v })}
                      />
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <meta.Icon className="h-3 w-3" /> {meta.subtitle}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`name-${meta.key}`}>Nome do agente</Label>
                    <Input
                      id={`name-${meta.key}`}
                      value={form.name}
                      onChange={(e) => patch(meta.key, { name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`avatar-${meta.key}`}>Foto do agente (URL)</Label>
                    <Input
                      id={`avatar-${meta.key}`}
                      placeholder="https://…"
                      value={form.avatar_url}
                      onChange={(e) => patch(meta.key, { avatar_url: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Sugestões gratuitas:{' '}
                      <a
                        href="https://thispersondoesnotexist.com"
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-primary"
                      >
                        ThisPersonDoesNotExist
                      </a>{' '}
                      ·{' '}
                      <a
                        href="https://unsplash.com/s/photos/portrait"
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-primary"
                      >
                        Unsplash
                      </a>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>LLM preferido</Label>
                    <div className="space-y-1.5">
                      <ProviderOption
                        label="Anthropic Claude"
                        ready={anthropicReady}
                        selected={form.provider === 'anthropic'}
                        onSelect={() => patch(meta.key, { provider: 'anthropic' })}
                      />
                      <ProviderOption
                        label="OpenAI GPT"
                        ready={openaiReady}
                        selected={form.provider === 'openai'}
                        onSelect={() => patch(meta.key, { provider: 'openai' })}
                      />
                      <ProviderOption
                        label="Usar melhor disponível (automático)"
                        ready={!noneReady}
                        selected={form.provider === 'auto'}
                        onSelect={() => patch(meta.key, { provider: 'auto' })}
                        auto
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => save(meta.key)}
                    disabled={saving === meta.key}
                  >
                    {saving === meta.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar configurações
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActiveToggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
        active
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
          : 'border-vortex-border bg-vortex-bg/60 text-muted-foreground',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-400' : 'bg-muted-foreground')}
      />
      {active ? 'Ativo' : 'Inativo'}
    </button>
  );
}

function ProviderOption({
  label,
  ready,
  selected,
  onSelect,
  auto,
}: {
  label: string;
  ready: boolean;
  selected: boolean;
  onSelect: () => void;
  auto?: boolean;
}) {
  const disabled = !ready && !auto; // "automático" é sempre selecionável (cai no fallback)
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
        selected
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-vortex-border bg-vortex-bg/40 text-foreground/80',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-full border',
            selected ? 'border-primary' : 'border-muted-foreground',
          )}
        >
          {selected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
        </span>
        {label}
      </span>
      <span
        className={cn(
          'flex items-center gap-1 text-[11px]',
          ready ? 'text-emerald-300' : 'text-muted-foreground',
        )}
      >
        {ready ? <Check className="h-3 w-3" /> : null}
        {auto ? (ready ? 'disponível' : 'sem IA configurada') : ready ? 'configurado' : 'não configurado'}
      </span>
    </button>
  );
}
