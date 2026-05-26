import { useNavigate } from 'react-router-dom';
import {
  Zap,
  AlertOctagon,
  AlertTriangle,
  Info,
  Check,
  CheckCheck,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ALERT_PRIORITY_LABEL, type Alert, type AlertPriority } from '@/types';

interface Props {
  alert: Alert;
  onMarkRead?: (id: string) => void;
  onMarkResolved?: (id: string) => void;
  compact?: boolean;
}

const STYLES: Record<
  AlertPriority,
  {
    icon: LucideIcon;
    border: string;
    bg: string;
    iconColor: string;
    pill: string;
  }
> = {
  urgente: {
    icon: Zap,
    border: 'border-l-4 border-l-red-500',
    bg: 'bg-red-500/10',
    iconColor: 'text-red-300',
    pill: 'bg-red-500/20 text-red-200 border-red-500/40',
  },
  critico: {
    icon: AlertOctagon,
    border: 'border-l-4 border-l-orange-500',
    bg: 'bg-orange-500/10',
    iconColor: 'text-orange-300',
    pill: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
  },
  atencao: {
    icon: AlertTriangle,
    border: 'border-l-4 border-l-amber-500',
    bg: 'bg-amber-500/10',
    iconColor: 'text-amber-300',
    pill: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  },
  info: {
    icon: Info,
    border: 'border-l-4 border-l-sky-500',
    bg: 'bg-sky-500/10',
    iconColor: 'text-sky-300',
    pill: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
  },
};

export function AlertCard({ alert, onMarkRead, onMarkResolved, compact }: Props) {
  const navigate = useNavigate();
  const s = STYLES[alert.priority];
  const Icon = s.icon;
  const title = alert.title ?? alert.message;
  const isUrgent = alert.priority === 'urgente';

  function onAction() {
    if (alert.acao_route) {
      navigate(alert.acao_route);
      onMarkRead?.(alert.id);
    }
  }

  return (
    <div
      className={`rounded-lg border border-vortex-border ${s.border} ${s.bg} ${
        alert.is_read ? 'opacity-70' : ''
      } ${isUrgent && !alert.is_read ? 'shadow-[0_0_20px_-4px_rgba(239,68,68,0.4)]' : ''}`}
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.bg}`}
        >
          <Icon className={`h-4 w-4 ${s.iconColor}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${s.pill}`}
            >
              {ALERT_PRIORITY_LABEL[alert.priority]}
            </span>
          </div>

          {alert.description ? (
            <p className={`mt-0.5 text-xs text-muted-foreground ${compact ? 'line-clamp-2' : ''}`}>
              {alert.description}
            </p>
          ) : null}

          {!compact && alert.acao_sugerida ? (
            <p className="mt-2 rounded-md bg-vortex-bg/60 p-2 text-[11px] text-foreground/90">
              💡 {alert.acao_sugerida}
            </p>
          ) : null}

          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(alert.created_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {alert.acao_label && alert.acao_route ? (
              <Button
                size="sm"
                variant={isUrgent ? 'default' : 'outline'}
                onClick={onAction}
              >
                {alert.acao_label}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {!alert.is_read && onMarkRead ? (
              <Button size="sm" variant="ghost" onClick={() => onMarkRead(alert.id)}>
                <Check className="h-3.5 w-3.5" /> Ciente
              </Button>
            ) : null}
            {onMarkResolved ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onMarkResolved(alert.id)}
                className="text-muted-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Resolver
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
