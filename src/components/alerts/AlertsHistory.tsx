import { useMemo, useState } from 'react';
import { Bell, History, CheckCheck, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterPill } from '@/components/data/FilterPill';
import { AlertCard } from './AlertCard';
import { useAlertas } from '@/hooks/useAlertas';
import { ALERT_PRIORITY_LABEL, type AlertPriority } from '@/types';

type Filter = 'todos' | AlertPriority | 'resolvidos';

const MS_DAY = 86_400_000;

// Visão expandida da Central de Alertas dentro do Dashboard.
// - Filtros por prioridade
// - Inclui aba "Resolvidos" com histórico dos últimos 30 dias
export function AlertsHistory() {
  const { alerts, open, counts, markRead, markResolved, markAllRead } = useAlertas();
  const [filter, setFilter] = useState<Filter>('todos');

  const resolved = useMemo(
    () =>
      alerts
        .filter((a) => a.is_resolved)
        .filter((a) => Date.now() - +new Date(a.created_at) < 30 * MS_DAY)
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [alerts],
  );

  const visible = useMemo(() => {
    if (filter === 'resolvidos') return resolved;
    if (filter === 'todos') {
      return open.slice().sort((a, b) => {
        const PR: Record<AlertPriority, number> = {
          urgente: 0,
          critico: 1,
          atencao: 2,
          info: 3,
        };
        const pd = PR[a.priority] - PR[b.priority];
        if (pd !== 0) return pd;
        return +new Date(b.created_at) - +new Date(a.created_at);
      });
    }
    return open.filter((a) => a.priority === filter);
  }, [filter, open, resolved]);

  const tabs: Array<{ value: Filter; label: string; count: number }> = [
    { value: 'todos', label: 'Todos', count: counts.total },
    { value: 'urgente', label: 'Urgentes', count: counts.urgente },
    { value: 'critico', label: 'Críticos', count: counts.critico },
    { value: 'atencao', label: 'Atenção', count: counts.atencao },
    { value: 'info', label: 'Info', count: counts.info },
    { value: 'resolvidos', label: 'Resolvidos', count: resolved.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-xs uppercase tracking-widest text-primary">
              Central de Alertas
            </span>
          </div>
          <h2 className="font-display text-3xl tracking-wide text-foreground">
            Sinais que precisam de ação
          </h2>
          <p className="text-sm text-muted-foreground">
            {counts.urgente > 0 ? (
              <span className="font-semibold text-red-300">
                {counts.urgente} urgente{counts.urgente > 1 ? 's' : ''} ·{' '}
              </span>
            ) : null}
            {counts.total} alertas abertos · {resolved.length} resolvidos nos últimos 30 dias
          </p>
        </div>
        {counts.unread > 0 ? (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" />
            Marcar todos como lidos
          </Button>
        ) : null}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <FilterPill
            key={t.value}
            label={t.label}
            count={t.count}
            active={filter === t.value}
            onClick={() => setFilter(t.value)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-vortex-border bg-vortex-surface/40 p-8 text-center">
          {filter === 'resolvidos' ? (
            <>
              <Archive className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-foreground">Sem histórico</p>
              <p className="text-xs text-muted-foreground">
                Alertas resolvidos nos últimos 30 dias aparecem aqui.
              </p>
            </>
          ) : (
            <>
              <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-foreground">Sem alertas nesta categoria</p>
              <p className="text-xs text-muted-foreground">
                A campanha está saudável nesse aspecto.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filter === 'resolvidos'
            ? visible.map((a) => (
                <div key={a.id} className="relative opacity-70">
                  <AlertCard alert={a} />
                  <Badge
                    variant="success"
                    className="absolute right-3 top-3 text-[10px]"
                  >
                    <History className="mr-1 h-3 w-3" /> Resolvido
                  </Badge>
                </div>
              ))
            : visible.map((a) => (
                <AlertCard
                  key={a.id}
                  alert={a}
                  onMarkRead={markRead}
                  onMarkResolved={markResolved}
                />
              ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Detecção automática a cada 30 minutos · prioridades:{' '}
        {(['urgente', 'critico', 'atencao', 'info'] as AlertPriority[]).map((p, i) => (
          <span key={p}>
            {i > 0 ? ' · ' : ''}
            {ALERT_PRIORITY_LABEL[p]}
          </span>
        ))}
      </p>
    </div>
  );
}
