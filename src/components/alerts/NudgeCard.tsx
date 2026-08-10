import { AlertCircle, UserPlus, TrendingUp, Trophy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Nudge, NudgeTone } from '@/lib/nudges';

const TONE_STYLE: Record<
  NudgeTone,
  { border: string; bg: string; icon: typeof AlertCircle; iconColor: string }
> = {
  acao: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    icon: AlertCircle,
    iconColor: 'text-amber-300',
  },
  convite: {
    border: 'border-vortex-violet/30',
    bg: 'bg-vortex-violet/10',
    icon: UserPlus,
    iconColor: 'text-vortex-violet',
  },
  ranking: {
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/10',
    icon: TrendingUp,
    iconColor: 'text-sky-300',
  },
  positivo: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    icon: Trophy,
    iconColor: 'text-emerald-300',
  },
};

interface Props {
  nudge: Nudge;
  onAction?: (route: string) => void;
}

export function NudgeCard({ nudge, onAction }: Props) {
  const style = TONE_STYLE[nudge.tone];
  const Icon = style.icon;
  return (
    <div className={cn('rounded-lg border p-3', style.border, style.bg)}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.iconColor)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{nudge.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {nudge.message}
          </p>
          {nudge.actionLabel && nudge.actionRoute ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => onAction?.(nudge.actionRoute as string)}
            >
              {nudge.actionLabel}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
