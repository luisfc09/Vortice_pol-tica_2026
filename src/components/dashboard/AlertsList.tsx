import { AlertTriangle, TrendingDown, MapPin, Trophy, Bell } from 'lucide-react';
import { collections, useCollection } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Alert, AlertType } from '@/types';

const ICONS: Record<AlertType, typeof AlertTriangle> = {
  spike_negativo: TrendingDown,
  municipio_inativo: MapPin,
  meta_atingida: Trophy,
  sistema: Bell,
};

const COLORS: Record<AlertType, string> = {
  spike_negativo: 'bg-red-500/15 text-red-300',
  municipio_inativo: 'bg-amber-500/15 text-amber-300',
  meta_atingida: 'bg-primary/15 text-primary',
  sistema: 'bg-blue-500/15 text-blue-300',
};

export function AlertsList() {
  const alerts = useCollection(collections.alerts);
  const visible: Alert[] = alerts
    .filter((a) => !a.is_read)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

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
      <div className="border-b border-vortex-border px-5 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alertas</p>
        <p className="font-display text-2xl tracking-wide text-foreground">Pendentes</p>
      </div>
      <ul className="divide-y divide-vortex-border">
        {visible.map((a) => {
          const Icon = ICONS[a.type];
          return (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${COLORS[a.type]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{a.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => markRead(a.id)} className="text-xs">
                Marcar lido
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
