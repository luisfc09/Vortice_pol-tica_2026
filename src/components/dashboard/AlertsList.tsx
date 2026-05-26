import { Link } from 'react-router-dom';
import { Bell, Zap, AlertOctagon, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { collections, useCollection } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Alert, AlertPriority } from '@/types';

const PRIORITY_ICON: Record<AlertPriority, typeof Bell> = {
  urgente: Zap,
  critico: AlertOctagon,
  atencao: AlertTriangle,
  info: Info,
};

const PRIORITY_CLASS: Record<AlertPriority, string> = {
  urgente: 'bg-red-500/15 text-red-300',
  critico: 'bg-orange-500/15 text-orange-300',
  atencao: 'bg-amber-500/15 text-amber-300',
  info: 'bg-sky-500/15 text-sky-300',
};

const PRIORITY_ORDER: Record<AlertPriority, number> = {
  urgente: 0,
  critico: 1,
  atencao: 2,
  info: 3,
};

export function AlertsList() {
  const alerts = useCollection(collections.alerts);
  const visible: Alert[] = alerts
    .filter((a) => !a.is_read && !a.is_resolved)
    .sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
      return +new Date(b.created_at) - +new Date(a.created_at);
    })
    .slice(0, 5);

  function markRead(id: string) {
    collections.alerts.update(id, { is_read: true });
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 text-center text-sm text-muted-foreground backdrop-blur">
        Sem alertas pendentes.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 backdrop-blur">
      <div className="flex items-center justify-between border-b border-vortex-border px-5 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Alertas
          </p>
          <p className="font-display text-2xl tracking-wide text-foreground">
            Pendentes
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/dashboard">
            Ver todos <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <ul className="divide-y divide-vortex-border">
        {visible.map((a) => {
          const Icon = PRIORITY_ICON[a.priority];
          const title = a.title ?? a.message;
          return (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${PRIORITY_CLASS[a.priority]}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{title}</p>
                {a.description ? (
                  <p className="line-clamp-1 text-xs text-muted-foreground">{a.description}</p>
                ) : null}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(a.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markRead(a.id)}
                className="text-xs"
              >
                OK
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
