import { BellRing, CheckCheck } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCard } from './AlertCard';
import { useAlertas } from '@/hooks/useAlertas';
import { ALERT_PRIORITY_LABEL, type AlertPriority } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTION_ORDER: AlertPriority[] = ['urgente', 'critico', 'atencao', 'info'];

const SECTION_HEAD: Record<AlertPriority, { caption: string; color: string }> = {
  urgente: { caption: 'Urgente — agir agora', color: 'text-red-300' },
  critico: { caption: 'Crítico — resolver hoje', color: 'text-orange-300' },
  atencao: { caption: 'Atenção', color: 'text-amber-300' },
  info: { caption: 'Informativos', color: 'text-sky-300' },
};

export function CentralAlertas({ open, onOpenChange }: Props) {
  const { buckets, counts, markRead, markResolved, markAllRead } = useAlertas();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md md:max-w-lg"
      >
        <SheetHeader className="mb-3">
          <SheetTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Central de Alertas
          </SheetTitle>
          <SheetDescription>
            {counts.urgente > 0 ? (
              <span>
                <span className="font-semibold text-red-300">
                  {counts.urgente} urgente{counts.urgente > 1 ? 's' : ''}
                </span>
                {' · '}
              </span>
            ) : null}
            {counts.total > 0
              ? `${counts.total} aberto${counts.total > 1 ? 's' : ''} · ${counts.unread} não lido${counts.unread === 1 ? '' : 's'}`
              : 'Nenhum alerta no momento'}
          </SheetDescription>
        </SheetHeader>

        {counts.unread > 0 ? (
          <div className="mb-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todos como lidos
            </Button>
          </div>
        ) : null}

        {counts.total === 0 ? (
          <div className="rounded-xl border border-dashed border-vortex-border bg-vortex-surface/40 p-6 text-center">
            <BellRing className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-foreground">Tudo em ordem</p>
            <p className="text-xs text-muted-foreground">
              Nenhum alerta detectado pela campanha. Reavaliamos a cada 30 minutos.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {SECTION_ORDER.map((p) => {
              const list = buckets[p];
              if (list.length === 0) return null;
              const head = SECTION_HEAD[p];
              return (
                <section key={p}>
                  <div className="mb-2 flex items-center justify-between">
                    <p
                      className={`text-[11px] font-medium uppercase tracking-widest ${head.color}`}
                    >
                      {head.caption}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {list.length} {ALERT_PRIORITY_LABEL[p].toLowerCase()}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {list.map((a) => (
                      <AlertCard
                        key={a.id}
                        alert={a}
                        compact
                        onMarkRead={markRead}
                        onMarkResolved={markResolved}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
