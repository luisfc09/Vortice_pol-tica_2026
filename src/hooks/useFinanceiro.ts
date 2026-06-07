// ============================================================================
// Vórtice — useFinanceiro
// ----------------------------------------------------------------------------
// Hook central do Módulo Financeiro. Concentra:
//   • Carregamento de FinanceConfig, FinanceRevenue[] e FinanceCityPlan[]
//     da campanha ativa (respeita view-as via useEffectiveSession).
//   • Cálculos derivados: receita total, gasto planejado/realizado,
//     saldo, custo/voto e cor do semáforo por cidade.
//   • Mutations CRUD para os 3 tipos (config upsert; revenues e plans
//     com create/update/delete).
//   • Subscriptions realtime — outros usuários da campanha veem
//     atualizações ao vivo.
//
// Padrão de design: similar a useIntelligence — carrega via supabase
// direto, mantém estado local e expõe API imperativa. Em USE_MOCKS
// devolve estado vazio (sem ruído no dev).
// ============================================================================

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import type {
  FinanceCityPlan,
  FinanceCitySummary,
  FinanceConfig,
  FinanceRevenue,
  RevenueSourceType,
  SemaforoColor,
} from '@/types';

// ----------------------------------------------------------------------------
// Cálculos puros — exportados para testes e reuso (widgets, alertas)
// ----------------------------------------------------------------------------

/**
 * Soma total PLANEJADO de uma cidade:
 *   coord_value + cabos_qty*cabo_unit_value + vehicles_cost +
 *   fuel_cost + materials_cost + others_cost.
 */
export function totalPlanejado(p: FinanceCityPlan): number {
  return (
    (p.coord_value || 0) +
    (p.cabos_qty || 0) * (p.cabo_unit_value || 0) +
    (p.vehicles_cost || 0) +
    (p.fuel_cost || 0) +
    (p.materials_cost || 0) +
    (p.others_cost || 0)
  );
}

/**
 * Soma total REALIZADO de uma cidade. Retorna null quando NENHUM campo
 * `_real` foi preenchido — assim a UI sabe diferenciar "zero realizado"
 * de "ainda não informaram".
 */
export function totalRealizado(p: FinanceCityPlan): number | null {
  const realFields = [
    p.coord_value_real,
    p.cabos_cost_real,
    p.vehicles_cost_real,
    p.fuel_cost_real,
    p.materials_cost_real,
    p.others_cost_real,
  ];
  const hasAny = realFields.some((v) => v !== null && v !== undefined);
  if (!hasAny) return null;
  return realFields.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

/**
 * Calcula a cor do semáforo de uma cidade a partir do custo/voto.
 * Regras (config):
 *   custo/voto ≤ semaforo_verde_max   → verde
 *   custo/voto ≤ semaforo_amarelo_max → amarelo
 *   custo/voto >  semaforo_amarelo_max → vermelho
 *   meta_votos = 0 ou custo = 0       → indeterminado
 */
export function semaforoColor(
  custoPorVoto: number | null,
  config: { semaforo_verde_max: number; semaforo_amarelo_max: number } | null,
): SemaforoColor {
  if (custoPorVoto == null || !config) return 'indeterminado';
  if (custoPorVoto <= config.semaforo_verde_max) return 'verde';
  if (custoPorVoto <= config.semaforo_amarelo_max) return 'amarelo';
  return 'vermelho';
}

/**
 * Resumo agregado de uma cidade — usado em tabelas, widgets e detectores
 * de alerta.
 */
export function summarizeCity(
  plan: FinanceCityPlan,
  config: FinanceConfig | null,
): FinanceCitySummary {
  const tp = totalPlanejado(plan);
  const tr = totalRealizado(plan);
  const meta22 = plan.meta_votos_2022 || 0;
  const meta26 = plan.meta_votos_2026 || 0;
  // Custo/voto usa a meta 2026 (planejado) — fallback para 2022 quando
  // a campanha ainda não definiu meta nova.
  const denom = meta26 > 0 ? meta26 : meta22;
  const cpvPlan = denom > 0 ? tp / denom : null;
  const cpvReal = tr != null && denom > 0 ? tr / denom : null;
  // Semáforo prefere o REALIZADO se já houver — senão usa planejado.
  const cpvUsado = cpvReal ?? cpvPlan;
  return {
    plan,
    total_planejado: tp,
    total_realizado: tr,
    custo_por_voto_planejado: cpvPlan,
    custo_por_voto_realizado: cpvReal,
    semaforo: semaforoColor(cpvUsado, config),
  };
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export interface UseFinanceiroResult {
  loading: boolean;
  config: FinanceConfig | null;
  revenues: FinanceRevenue[];
  cityPlans: FinanceCityPlan[];

  // Derivados
  totalReceitas: number;
  totalPlanejadoGeral: number;
  totalRealizadoGeral: number;
  saldoPrevisto: number;       // receitas - planejado
  custoPorVotoGeral: number | null;
  citySummaries: FinanceCitySummary[];

  // Mutations
  upsertConfig: (patch: Partial<FinanceConfig>) => Promise<FinanceConfig | null>;
  createRevenue: (r: Omit<FinanceRevenue, 'id' | 'campaign_id' | 'created_at' | 'created_by'>) => Promise<FinanceRevenue | null>;
  deleteRevenue: (id: string) => Promise<void>;
  createCityPlan: (p: Partial<FinanceCityPlan> & { city_name: string }) => Promise<FinanceCityPlan | null>;
  updateCityPlan: (id: string, patch: Partial<FinanceCityPlan>) => Promise<FinanceCityPlan | null>;
  deleteCityPlan: (id: string) => Promise<void>;

  refresh: () => Promise<void>;
}

export function useFinanceiro(): UseFinanceiroResult {
  const session = useEffectiveSession();
  const campaignId = session?.campaign?.id ?? null;
  // String estável por instância do hook. Usada no nome do channel pra
  // evitar colisão quando o hook é chamado de múltiplos lugares
  // (Header→AlertsBadge→useAlertas, Dashboard direto, FinanceDashboardWidget).
  // Sem isso, todos pegavam o MESMO channel e o segundo .subscribe()
  // travava o boot do React. Ver lição em §14.4 das docs.
  const instanceId = useId();

  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<FinanceConfig | null>(null);
  const [revenues, setRevenues] = useState<FinanceRevenue[]>([]);
  const [cityPlans, setCityPlans] = useState<FinanceCityPlan[]>([]);

  // ---------------- Loaders ----------------
  const refresh = useCallback(async () => {
    if (!campaignId || USE_MOCKS) {
      setConfig(null);
      setRevenues([]);
      setCityPlans([]);
      return;
    }
    setLoading(true);
    try {
      const [cfgRes, revRes, planRes] = await Promise.all([
        supabase
          .from('campaign_finance_config')
          .select('*')
          .eq('campaign_id', campaignId)
          .maybeSingle(),
        supabase
          .from('finance_revenues')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('revenue_date', { ascending: false }),
        supabase
          .from('finance_city_plans')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('city_name', { ascending: true }),
      ]);
      if (cfgRes.error)
        console.warn('[finance] config load:', cfgRes.error.message);
      if (revRes.error)
        console.warn('[finance] revenues load:', revRes.error.message);
      if (planRes.error)
        console.warn('[finance] city_plans load:', planRes.error.message);
      setConfig((cfgRes.data as FinanceConfig) ?? null);
      setRevenues((revRes.data as FinanceRevenue[]) ?? []);
      setCityPlans((planRes.data as FinanceCityPlan[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ---------------- Realtime ----------------
  // Cada instância do hook abre o SEU próprio channel via `useId()` no nome —
  // evita a colisão histórica de 3 consumers pegando o mesmo channel
  // (Header→AlertsBadge→useAlertas, Dashboard direto, FinanceDashboardWidget).
  // Tradeoff: tráfego duplicado (N subscriptions × 3 tables). Aceitável até
  // ~5 instâncias. Se escalar, migrar pra um Zustand store singleton com 1
  // subscription única — vide pendência registrada em §14.4 das docs.
  useEffect(() => {
    if (!campaignId || USE_MOCKS) return;
    const channel = supabase
      .channel(`finance-${campaignId}-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_finance_config',
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'finance_revenues',
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'finance_city_plans',
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, refresh, instanceId]);

  // ---------------- Derivados ----------------
  const totalReceitas = useMemo(
    () => revenues.reduce((acc, r) => acc + (r.amount || 0), 0),
    [revenues],
  );

  const citySummaries = useMemo(
    () => cityPlans.map((p) => summarizeCity(p, config)),
    [cityPlans, config],
  );

  const totalPlanejadoGeral = useMemo(
    () => citySummaries.reduce((acc, s) => acc + s.total_planejado, 0),
    [citySummaries],
  );

  const totalRealizadoGeral = useMemo(
    () =>
      citySummaries.reduce(
        (acc, s) => acc + (s.total_realizado ?? 0),
        0,
      ),
    [citySummaries],
  );

  const saldoPrevisto = totalReceitas - totalPlanejadoGeral;

  const custoPorVotoGeral = useMemo(() => {
    const metaCfg = config?.meta_votos_geral ?? 0;
    const metaSession = session?.campaign?.vote_target ?? 0;
    const meta = metaCfg > 0 ? metaCfg : metaSession;
    if (meta <= 0) return null;
    return totalPlanejadoGeral / meta;
  }, [config?.meta_votos_geral, session?.campaign?.vote_target, totalPlanejadoGeral]);

  // ---------------- Mutations ----------------
  const upsertConfig = useCallback<UseFinanceiroResult['upsertConfig']>(
    async (patch) => {
      if (!campaignId || USE_MOCKS) return null;
      const payload = { campaign_id: campaignId, ...patch };
      const { data, error } = await supabase
        .from('campaign_finance_config')
        .upsert(payload, { onConflict: 'campaign_id' })
        .select()
        .single();
      if (error) {
        console.warn('[finance] upsertConfig:', error.message);
        return null;
      }
      setConfig(data as FinanceConfig);
      return data as FinanceConfig;
    },
    [campaignId],
  );

  const createRevenue = useCallback<UseFinanceiroResult['createRevenue']>(
    async (r) => {
      if (!campaignId || USE_MOCKS) return null;
      const { data, error } = await supabase
        .from('finance_revenues')
        .insert({
          campaign_id: campaignId,
          source_type: r.source_type,
          description: r.description,
          amount: r.amount,
          revenue_date: r.revenue_date,
          notes: r.notes,
        })
        .select()
        .single();
      if (error) {
        console.warn('[finance] createRevenue:', error.message);
        return null;
      }
      setRevenues((prev) => [data as FinanceRevenue, ...prev]);
      return data as FinanceRevenue;
    },
    [campaignId],
  );

  const deleteRevenue = useCallback<UseFinanceiroResult['deleteRevenue']>(
    async (id) => {
      if (!campaignId || USE_MOCKS) return;
      const { error } = await supabase
        .from('finance_revenues')
        .delete()
        .eq('id', id);
      if (error) {
        console.warn('[finance] deleteRevenue:', error.message);
        return;
      }
      setRevenues((prev) => prev.filter((r) => r.id !== id));
    },
    [campaignId],
  );

  const createCityPlan = useCallback<UseFinanceiroResult['createCityPlan']>(
    async (p) => {
      if (!campaignId || USE_MOCKS) return null;
      const { data, error } = await supabase
        .from('finance_city_plans')
        .insert({
          campaign_id: campaignId,
          city_name: p.city_name,
          municipality_code: p.municipality_code ?? null,
          polo_logistico: p.polo_logistico ?? null,
          meta_votos_2022: p.meta_votos_2022 ?? 0,
          meta_votos_2026: p.meta_votos_2026 ?? 0,
          coord_name: p.coord_name ?? null,
          coord_value: p.coord_value ?? 0,
          cabos_qty: p.cabos_qty ?? 0,
          cabo_unit_value: p.cabo_unit_value ?? 0,
          vehicles_qty: p.vehicles_qty ?? 0,
          vehicles_cost: p.vehicles_cost ?? 0,
          fuel_cost: p.fuel_cost ?? 0,
          materials_cost: p.materials_cost ?? 0,
          others_cost: p.others_cost ?? 0,
          notes: p.notes ?? null,
        })
        .select()
        .single();
      if (error) {
        console.warn('[finance] createCityPlan:', error.message);
        return null;
      }
      setCityPlans((prev) =>
        [...prev, data as FinanceCityPlan].sort((a, b) =>
          a.city_name.localeCompare(b.city_name, 'pt-BR'),
        ),
      );
      return data as FinanceCityPlan;
    },
    [campaignId],
  );

  const updateCityPlan = useCallback<UseFinanceiroResult['updateCityPlan']>(
    async (id, patch) => {
      if (!campaignId || USE_MOCKS) return null;
      const { data, error } = await supabase
        .from('finance_city_plans')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.warn('[finance] updateCityPlan:', error.message);
        return null;
      }
      setCityPlans((prev) =>
        prev.map((p) => (p.id === id ? (data as FinanceCityPlan) : p)),
      );
      return data as FinanceCityPlan;
    },
    [campaignId],
  );

  const deleteCityPlan = useCallback<UseFinanceiroResult['deleteCityPlan']>(
    async (id) => {
      if (!campaignId || USE_MOCKS) return;
      const { error } = await supabase
        .from('finance_city_plans')
        .delete()
        .eq('id', id);
      if (error) {
        console.warn('[finance] deleteCityPlan:', error.message);
        return;
      }
      setCityPlans((prev) => prev.filter((p) => p.id !== id));
    },
    [campaignId],
  );

  return {
    loading,
    config,
    revenues,
    cityPlans,
    totalReceitas,
    totalPlanejadoGeral,
    totalRealizadoGeral,
    saldoPrevisto,
    custoPorVotoGeral,
    citySummaries,
    upsertConfig,
    createRevenue,
    deleteRevenue,
    createCityPlan,
    updateCityPlan,
    deleteCityPlan,
    refresh,
  };
}

// ----------------------------------------------------------------------------
// Constantes auxiliares (usadas em UI: select de fonte de receita)
// ----------------------------------------------------------------------------
export const REVENUE_SOURCE_OPTIONS: readonly RevenueSourceType[] = [
  'fundo_eleitoral',
  'doacao_pessoa_fisica',
  'doacao_pessoa_juridica',
  'recursos_proprios',
  'outros',
] as const;
