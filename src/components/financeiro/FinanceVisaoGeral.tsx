// FinanceVisaoGeral — aba "Visão Geral" do módulo financeiro.
// KPIs grandes (receita, planejado, realizado, saldo, R$/voto geral) +
// breakdown do semáforo (quantas cidades em verde/amarelo/vermelho) +
// top 5 cidades mais caras por R$/voto.

import { useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  Calculator,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useFinanceiro } from '@/hooks/useFinanceiro';
import { SemaforoIndicator, SEMAFORO_LABEL } from './SemaforoIndicator';
import type { SemaforoColor } from '@/types';

const BR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'primary' | 'success' | 'danger' | 'warning' | 'violet';
}

const ACCENT_CLASS: Record<NonNullable<KpiProps['accent']>, string> = {
  primary: 'text-primary',
  success: 'text-emerald-400',
  danger: 'text-red-400',
  warning: 'text-amber-400',
  violet: 'text-vortex-violet',
};

function Kpi({ label, value, hint, icon: Icon, accent = 'primary' }: KpiProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${ACCENT_CLASS[accent]}`} />
        {label}
      </div>
      <div className={`mt-2 font-display text-2xl ${ACCENT_CLASS[accent]}`}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </Card>
  );
}

export function FinanceVisaoGeral() {
  const {
    config,
    revenues,
    citySummaries,
    totalReceitas,
    totalPlanejadoGeral,
    totalRealizadoGeral,
    saldoPrevisto,
    custoPorVotoGeral,
  } = useFinanceiro();

  const semaforoCount = useMemo(() => {
    const c: Record<SemaforoColor, number> = {
      verde: 0,
      amarelo: 0,
      vermelho: 0,
      indeterminado: 0,
    };
    for (const s of citySummaries) c[s.semaforo]++;
    return c;
  }, [citySummaries]);

  // Top 5 cidades mais caras por R$/voto (entre as com custo definido).
  const topMaisCaras = useMemo(
    () =>
      citySummaries
        .filter(
          (s) =>
            (s.custo_por_voto_realizado ?? s.custo_por_voto_planejado) != null,
        )
        .sort((a, b) => {
          const av = a.custo_por_voto_realizado ?? a.custo_por_voto_planejado ?? 0;
          const bv = b.custo_por_voto_realizado ?? b.custo_por_voto_planejado ?? 0;
          return bv - av;
        })
        .slice(0, 5),
    [citySummaries],
  );

  const budgetTotal = config?.budget_total ?? null;
  const tetoUltrapassado =
    budgetTotal != null && totalPlanejadoGeral > budgetTotal;

  return (
    <div className="space-y-6">
      {/* KPIs grandes ------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label="Receitas"
          value={BR.format(totalReceitas)}
          hint={`${revenues.length} registro${revenues.length === 1 ? '' : 's'}`}
          icon={Wallet}
          accent="success"
        />
        <Kpi
          label="Planejado"
          value={BR.format(totalPlanejadoGeral)}
          hint={
            budgetTotal != null
              ? `Teto: ${BR.format(budgetTotal)}${tetoUltrapassado ? ' ⚠' : ''}`
              : 'Sem teto definido'
          }
          icon={Calculator}
          accent={tetoUltrapassado ? 'danger' : 'primary'}
        />
        <Kpi
          label="Realizado"
          value={BR.format(totalRealizadoGeral)}
          hint={
            totalPlanejadoGeral > 0
              ? `${((totalRealizadoGeral / totalPlanejadoGeral) * 100).toFixed(0)}% do planejado`
              : undefined
          }
          icon={Activity}
          accent="warning"
        />
        <Kpi
          label="Saldo previsto"
          value={BR.format(saldoPrevisto)}
          hint={saldoPrevisto >= 0 ? 'Receitas − planejado' : 'Receitas insuficientes'}
          icon={saldoPrevisto >= 0 ? ArrowUpRight : ArrowDownRight}
          accent={saldoPrevisto >= 0 ? 'success' : 'danger'}
        />
        <Kpi
          label="R$/voto (geral)"
          value={
            custoPorVotoGeral != null
              ? BR.format(custoPorVotoGeral)
              : '—'
          }
          hint={
            custoPorVotoGeral == null
              ? 'Defina meta de votos'
              : config
                ? `Verde ≤ ${BR.format(config.semaforo_verde_max)}`
                : undefined
          }
          icon={TrendingUp}
          accent="violet"
        />
      </div>

      {/* Breakdown semáforo ------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Cidades por semáforo</h3>
            <span className="text-xs text-muted-foreground">
              {citySummaries.length} cidade{citySummaries.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['verde', 'amarelo', 'vermelho', 'indeterminado'] as SemaforoColor[]).map(
              (c) => (
                <div
                  key={c}
                  className="rounded-lg border border-border/60 bg-vortex-surface/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <SemaforoIndicator color={c} />
                    <span className="text-xs uppercase text-muted-foreground">
                      {SEMAFORO_LABEL[c]}
                    </span>
                  </div>
                  <div className="mt-1 font-display text-2xl">
                    {semaforoCount[c]}
                  </div>
                </div>
              ),
            )}
          </div>
        </Card>

        {/* Top 5 mais caras ----------------------------------------- */}
        <Card className="p-5 space-y-3">
          <div>
            <h3 className="font-display text-lg">Cidades mais caras (R$/voto)</h3>
            <p className="text-xs text-muted-foreground">
              Maior custo por voto — atenção aos vermelhos.
            </p>
          </div>
          {topMaisCaras.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              Sem dados suficientes ainda. Cadastre cidades com meta de votos.
            </div>
          ) : (
            <ul className="space-y-2">
              {topMaisCaras.map((s, i) => {
                const cpv =
                  s.custo_por_voto_realizado ?? s.custo_por_voto_planejado ?? 0;
                return (
                  <li
                    key={s.plan.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-vortex-surface/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {i + 1}.
                      </span>
                      <SemaforoIndicator color={s.semaforo} />
                      <span className="font-medium truncate">
                        {s.plan.city_name}
                      </span>
                    </div>
                    <span className="font-medium tabular-nums">
                      {BR.format(cpv)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
