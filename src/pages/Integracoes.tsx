import { useEffect, useMemo, useState } from 'react';
import { Plug, Filter, Sparkles, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FilterPill } from '@/components/data/FilterPill';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { IntegrationDrawer } from '@/components/integrations/IntegrationDrawer';
import { AiFeatureMatrix } from '@/components/integrations/AiFeatureMatrix';
import { AgentsConfig } from '@/components/agents/AgentsConfig';
import { supabase } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { INTEGRATION_CATALOG, type IntegrationSpec } from '@/data/integration-catalog';
import type { IntegrationSafe, IntegrationType } from '@/types';

type CategoryFilter = 'all' | IntegrationSpec['category'];

export default function IntegracoesPage() {
  // Sessão efetiva: respeita "Ver como cliente" do super admin → opera a
  // campanha escolhida, não a current_campaign_id() (membership mais antiga).
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;
  const [list, setList] = useState<IntegrationSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [selected, setSelected] = useState<IntegrationSpec | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function load() {
    setLoading(true);
    // Tenta a versão com campanha explícita (migration-040). Se ainda não foi
    // aplicada, faz fallback para a versão sem parâmetro (current_campaign_id).
    let res = await supabase.rpc('list_integrations_safe', { p_campaign_id: campaignId });
    if (res.error) {
      res = await supabase.rpc('list_integrations_safe');
    }
    setLoading(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    setList((res.data ?? []) as IntegrationSafe[]);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const byType: Record<IntegrationType, IntegrationSafe | null> = useMemo(() => {
    const map = Object.fromEntries(
      INTEGRATION_CATALOG.map((c) => [c.type, null as IntegrationSafe | null]),
    ) as Record<IntegrationType, IntegrationSafe | null>;
    for (const i of list) {
      map[i.type] = i;
    }
    return map;
  }, [list]);

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? INTEGRATION_CATALOG
        : INTEGRATION_CATALOG.filter((c) => c.category === filter),
    [filter],
  );

  const categories: Array<{ value: CategoryFilter; label: string; count: number }> = [
    { value: 'all', label: 'Todas', count: INTEGRATION_CATALOG.length },
    { value: 'IA', label: 'IA', count: INTEGRATION_CATALOG.filter((c) => c.category === 'IA').length },
    {
      value: 'Coleta',
      label: 'Coleta',
      count: INTEGRATION_CATALOG.filter((c) => c.category === 'Coleta').length,
    },
    {
      value: 'Mídia paga',
      label: 'Mídia paga',
      count: INTEGRATION_CATALOG.filter((c) => c.category === 'Mídia paga').length,
    },
    {
      value: 'Mensageria',
      label: 'Mensageria',
      count: INTEGRATION_CATALOG.filter((c) => c.category === 'Mensageria').length,
    },
  ];

  const connectedCount = list.filter((i) => i.is_enabled && i.has_secret).length;

  function configure(spec: IntegrationSpec) {
    if (spec.status === 'soon') {
      toast.info('Em breve. Aguardando lançamento dessa integração.');
      return;
    }
    setSelected(spec);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" />
            <span className="text-xs uppercase tracking-widest text-primary">Integrações</span>
          </div>
          <h2 className="font-display text-3xl tracking-wide text-foreground">
            Conexões da campanha
          </h2>
          <p className="text-sm text-muted-foreground">
            {connectedCount}{' '}
            {connectedCount === 1 ? 'integração conectada' : 'integrações conectadas'} de{' '}
            {INTEGRATION_CATALOG.filter((c) => c.status === 'available').length} disponíveis.
          </p>
        </div>
        <Badge variant="outline" className="self-start">
          <Filter className="mr-1 h-3 w-3" /> credenciais isoladas por campanha
        </Badge>
      </div>

      <Tabs defaultValue="connections">
        <TabsList>
          <TabsTrigger value="connections">
            <Plug className="mr-1 h-4 w-4" />
            Conexões
          </TabsTrigger>
          <TabsTrigger value="ai-features">
            <Sparkles className="mr-1 h-4 w-4" />
            IA por funcionalidade
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Bot className="mr-1 h-4 w-4" />
            Agentes de IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <FilterPill
                key={c.value}
                label={c.label}
                count={c.count}
                active={filter === c.value}
                onClick={() => setFilter(c.value)}
              />
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando integrações...</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((spec) => (
                <IntegrationCard
                  key={spec.type}
                  spec={spec}
                  integration={byType[spec.type]}
                  onConfigure={() => configure(spec)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai-features">
          <AiFeatureMatrix integrations={list} />
        </TabsContent>

        <TabsContent value="agents">
          <AgentsConfig integrations={list} />
        </TabsContent>
      </Tabs>

      <IntegrationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        spec={selected}
        integration={selected ? byType[selected.type] : null}
        onSaved={load}
      />
    </div>
  );
}
