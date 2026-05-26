import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Zap,
  RefreshCw,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CampaignSignal, SignalLevel } from '@/lib/pulse';

interface Props {
  signals: CampaignSignal[];
  onRefresh?: () => void;
}

const LEVEL_META: Record<
  SignalLevel,
  { icon: LucideIcon; iconColor: string; bg: string; border: string; pill: string }
> = {
  good: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    pill: 'Bom',
  },
  warn: {
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    pill: 'Atenção',
  },
  critical: {
    icon: AlertOctagon,
    iconColor: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    pill: 'Crítico',
  },
  urgent: {
    icon: Zap,
    iconColor: 'text-red-300',
    bg: 'bg-red-500/15',
    border: 'border-red-500/50',
    pill: 'Urgente',
  },
};

export function CampaignSignals({ signals, onRefresh }: Props) {
  const urgentCount = signals.filter((s) => s.level === 'urgent').length;
  const criticalCount = signals.filter((s) => s.level === 'critical').length;
  const warnCount = signals.filter((s) => s.level === 'warn').length;

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 backdrop-blur">
      <div className="flex items-center justify-between border-b border-vortex-border px-5 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Sinais da campanha
          </p>
          <p className="font-display text-xl tracking-wide text-foreground">
            {urgentCount + criticalCount > 0
              ? `${urgentCount + criticalCount} alertas precisam de ação`
              : warnCount > 0
                ? `${warnCount} pontos de atenção`
                : 'Tudo em ordem'}
          </p>
        </div>
        {onRefresh ? (
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        ) : null}
      </div>

      {signals.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Sem dados suficientes ainda. Cadastre lideranças e eleitores para começar a ver sinais.
        </p>
      ) : (
        <ul className="divide-y divide-vortex-border">
          {signals.map((sig) => {
            const meta = LEVEL_META[sig.level];
            const Icon = meta.icon;
            return (
              <li
                key={sig.id}
                className={`flex items-start gap-3 px-5 py-3 ${meta.bg}`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.border}`}
                >
                  <Icon className={`h-4 w-4 ${meta.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{sig.title}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${meta.border} ${meta.iconColor}`}
                    >
                      {meta.pill}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{sig.description}</p>
                </div>
                {sig.cta ? (
                  <Button asChild variant="ghost" size="sm" className="shrink-0">
                    <Link to={sig.cta.to}>
                      {sig.cta.label}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
