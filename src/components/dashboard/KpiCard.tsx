import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'violet';
  trendPct?: number;
  progress?: number; // 0..1
  progressLabel?: string;
}

const ACCENTS: Record<NonNullable<KpiCardProps['accent']>, string> = {
  primary: 'text-vortex-lime bg-vortex-lime/10',
  success: 'text-emerald-300 bg-emerald-500/10',
  warning: 'text-amber-300 bg-amber-500/10',
  destructive: 'text-red-300 bg-red-500/10',
  violet: 'text-vortex-violet bg-vortex-violet/15',
};

const PCT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  signDisplay: 'always',
  maximumFractionDigits: 1,
});

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'primary',
  trendPct,
  progress,
  progressLabel,
}: KpiCardProps) {
  const trendPositive = (trendPct ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${ACCENTS[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-4xl tracking-wide text-foreground">{value}</p>

      {typeof trendPct === 'number' ? (
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          {trendPositive ? (
            <TrendingUp className="h-3 w-3 text-emerald-400" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-400" />
          )}
          <span className={trendPositive ? 'text-emerald-400' : 'text-red-400'}>
            {PCT.format(trendPct)}
          </span>
          <span className="text-muted-foreground">esta semana</span>
        </div>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}

      {typeof progress === 'number' ? (
        <div className="mt-3">
          {progressLabel ? (
            <p className="mb-1 text-[11px] text-muted-foreground">{progressLabel}</p>
          ) : null}
          <div className="h-1.5 overflow-hidden rounded-full bg-vortex-bg">
            <div
              className="h-full bg-gradient-to-r from-vortex-violet to-vortex-lime"
              style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
