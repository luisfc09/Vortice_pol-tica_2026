import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PLANS,
  PLAN_ORDER,
  formatPlanPrice,
  formatLimit,
} from '@/lib/plans';
import type { CampaignPlan } from '@/types';

interface PlanCardsProps {
  value: CampaignPlan;
  onChange: (plan: CampaignPlan) => void;
  /** Layout compacto (modal estreito) → empilha sempre. */
  compact?: boolean;
}

// Cards de plano selecionáveis — fonte de dados é src/lib/plans.ts (não
// hardcoda preço/limite). Reusado no provisionamento e no modal "Assinar".
export function PlanCards({ value, onChange, compact }: PlanCardsProps) {
  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3')}>
      {PLAN_ORDER.map((key) => {
        const p = PLANS[key];
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={selected}
            className={cn(
              'relative rounded-xl border p-4 text-left transition-colors',
              selected
                ? 'border-primary bg-primary/10'
                : 'border-vortex-border bg-vortex-surface/40 hover:border-primary/40',
            )}
          >
            {selected ? (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <p className="font-display text-lg tracking-wide text-foreground">{p.name}</p>
            <p className="mb-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{formatPlanPrice(key)}</span>/mês
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>{formatLimit(p.limits.supporters)} lideranças</li>
              <li>{formatLimit(p.limits.voters)} eleitores</li>
              <li>{formatLimit(p.limits.members)} membros</li>
            </ul>
            <p className="mt-3 text-[11px] font-medium text-primary/90">
              {key === 'basico'
                ? 'Módulos base'
                : key === 'intermediario'
                  ? '+ Menções, TSE, Ranking'
                  : '+ Inteligência Eleitoral IA'}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// Radio simples reutilizável (não há componente Radio no design system).
interface RadioOptionProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}

export function RadioOption({ selected, onSelect, title, description }: RadioOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/10'
          : 'border-vortex-border bg-vortex-surface/40 hover:border-primary/40',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-primary' : 'border-muted-foreground',
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
