import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MiniKpiProps {
  label: string;
  value: number | string;
  trendPct: number;
  icon: LucideIcon;
  accent?: 'lime' | 'violet' | 'amber' | 'sky';
}

const PCT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  signDisplay: 'always',
  maximumFractionDigits: 1,
});

const ACCENT: Record<NonNullable<MiniKpiProps['accent']>, string> = {
  lime: 'text-vortex-lime',
  violet: 'text-vortex-violet',
  amber: 'text-amber-300',
  sky: 'text-sky-300',
};

export function MiniKpi({ label, value, trendPct, icon: Icon, accent = 'lime' }: MiniKpiProps) {
  const positive = trendPct >= 0;
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${ACCENT[accent]}`} />
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 font-display text-3xl tracking-wide text-foreground">{value}</p>
      <div className="mt-0.5 flex items-center gap-1 text-[11px]">
        {positive ? (
          <TrendingUp className="h-3 w-3 text-emerald-400" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-400" />
        )}
        <span className={positive ? 'text-emerald-400' : 'text-red-400'}>
          {PCT.format(trendPct)}
        </span>
        <span className="text-muted-foreground">esta semana</span>
      </div>
    </div>
  );
}
