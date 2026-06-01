// FinanceDashboardWidget — widget compacto da aba "Financeiro" no Dashboard.
// Mostra 5 KPIs grandes (Receitas, Planejado, Realizado, Saldo, R$/voto),
// breakdown do semáforo por cidade, top 3 cidades mais caras e CTA pra
// /financeiro. Compartilha cálculos com useFinanceiro (sem duplicação).
//
// Diferente do FinanceVisaoGeral (página interna), aqui:
//   • Usa o mesmo visual do Dashboard (KpiCard nativo).
//   • Mostra Top 3 em vez de Top 5 (cabe melhor no layout).
//   • CTA final "Abrir Financeiro" leva pra rota dedicada.

import { Link } from 'react-router-dom';
import {
  Wallet,
  Calculator,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Building2,
  ExternalLink,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { SemaforoIndicator, SEMAFORO_LABEL } from '@/components/financeiro/SemaforoIndicator';
import { useFinanceiro } from '@/hooks/useFinanceiro';
import type { SemaforoColor } from '@/types';

const BR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const BR_FULL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function FinanceDashboardWidget() {
  const {
    config,
    citySummaries,
    totalReceitas,
    totalPlanejadoGeral,
    totalRealizadoGeral,
    saldoPrevisto,
    custoPorVotoGeral,
  } = useFinanceiro();

  // Conta cidades por semáforo
  const counts: Record<SemaforoColor, number> = {
    verde: 0,
    amarelo: 0,
    vermelho: 0,
    indeterminado: 0,
  };
  for (const s of citySummaries) counts[s.semaforo]++;

  // Top 3 mais caras (R$/voto)
  const top3 = citySummaries
    .filter(
      (s) =>
        (s.custo_por_voto_realizado ?? s.custo_por_voto_planejado) != null,
    )
    .sort((a, b) => {
      const av = a.custo_por_voto_realizado ?? a.custo_por_voto_planejado ?? 0;
      const bv = b.custo_por_voto_realizado ?? b.custo_por_voto_planejado ?? 0;
      return bv - av;
    })
    .slice(0, 3);

  const budgetTotal = config?.budget_total ?? null;
  const tetoUltrapassado =
    budgetTotal != null && totalPlanejadoGeral > budgetTotal;
  const semDados =
    totalReceitas === 0 &&
    totalPlanejadoGeral === 0 &&
    citySummaries.length === 0;

  // -------------- estado "sem dados" -------------------------------
  if (semDados) {
    return (
      <div className="rounded-xl border border-dashed border-vortex-border bg-vortex-surface/40 p-8 text-center backdrop-blur">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <DollarSign className="h-6 w-6" />
        </div>
        <p className="font-display text-lg text-foreground">
          Sem dados financeiros ainda
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre receitas e o planejamento por cidade para acompanhar
          custo/voto e semáforo em tempo real.
        </p>
        <Button asChild className="mt-4">
          <Link to="/financeiro">
            <ExternalLink className="mr-1 h-4 w-4" /> Configurar Financeiro
          </Link>
        </Button>
      </div>
    );
  }

  // -------------- render normal ------------------------------------
  return (
    <div className="space-y-6">
      {/* 5 KPIs grandes (mesmo estilo do Dashboard.overview) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Receitas"
          value={BR.format(totalReceitas)}
          icon={Wallet}
          accent="success"
        />
        <KpiCard
          label="Planejado"
          value={BR.format(totalPlanejadoGeral)}
          hint={
            budgetTotal != null
              ? `Teto: ${BR.format(budgetTotal)}${tetoUltrapassado ? ' ⚠' : ''}`
              : 'Sem teto definido'
          }
          icon={Calculator}
          accent={tetoUltrapassado ? 'destructive' : 'primary'}
        />
        <KpiCard
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
        <KpiCard
          label="Saldo previsto"
          value={BR.format(saldoPrevisto)}
          hint={
            saldoPrevisto >= 0
              ? 'Receitas − planejado'
              : 'Receitas insuficientes'
          }
          icon={saldoPrevisto >= 0 ? ArrowUpRight : ArrowDownRight}
          accent={saldoPrevisto >= 0 ? 'success' : 'destructive'}
        />
        <KpiCard
          label="R$/voto"
          value={
            custoPorVotoGeral != null ? BR_FULL.format(custoPorVotoGeral) : '—'
          }
          hint={
            custoPorVotoGeral == null
              ? 'Defina meta de votos'
              : config
                ? `Verde ≤ ${BR_FULL.format(config.semaforo_verde_max)}`
                : undefined
          }
          icon={TrendingUp}
          accent="violet"
        />
      </div>

      {/* Breakdown + Top 3 lado a lado */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Semáforo --------------------------------------------- */}
        <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cidades por semáforo
            </p>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {citySummaries.length} cidade{citySummaries.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['verde', 'amarelo', 'vermelho', 'indeterminado'] as SemaforoColor[]).map(
              (c) => (
                <div
                  key={c}
                  className="rounded-lg border border-border/60 bg-vortex-bg/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <SemaforoIndicator color={c} />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {SEMAFORO_LABEL[c]}
                    </span>
                  </div>
                  <p className="mt-1 font-display text-2xl text-foreground">
                    {counts[c]}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Top 3 mais caras ------------------------------------- */}
        <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cidades mais caras (R$/voto)
          </p>
          {top3.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Sem dados suficientes — cadastre cidades com meta de votos.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {top3.map((s, i) => {
                const cpv =
                  s.custo_por_voto_realizado ??
                  s.custo_por_voto_planejado ??
                  0;
                return (
                  <li
                    key={s.plan.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-vortex-bg/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {i + 1}.
                      </span>
                      <SemaforoIndicator color={s.semaforo} />
                      <span className="truncate text-sm font-medium text-foreground">
                        {s.plan.city_name}
                      </span>
                    </div>
                    <span className="tabular-nums text-sm font-medium text-foreground">
                      {BR_FULL.format(cpv)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* CTA pra página completa */}
      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link to="/financeiro">
            <ExternalLink className="mr-1 h-4 w-4" /> Abrir Financeiro
          </Link>
        </Button>
      </div>
    </div>
  );
}
