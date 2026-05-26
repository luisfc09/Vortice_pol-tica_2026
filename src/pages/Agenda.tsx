import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/data/EmptyState';
import { ConfirmDelete } from '@/components/data/ConfirmDelete';
import { EventFormSheet } from '@/components/events/EventFormSheet';
import { collections, useCollection } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import type { CampaignEvent, EventType } from '@/types';

const TYPE_LABEL: Record<EventType, string> = {
  comicio: 'Comício',
  reuniao: 'Reunião',
  visita: 'Visita',
  midia: 'Mídia',
  outro: 'Outro',
};

const TYPE_VARIANT: Record<EventType, 'default' | 'secondary' | 'success' | 'warning' | 'outline'> = {
  comicio: 'default',
  reuniao: 'secondary',
  visita: 'success',
  midia: 'warning',
  outro: 'outline',
};

export default function AgendaPage() {
  const session = useAuthStore((s) => s.session);
  const events = useCollection(collections.events);
  const [editing, setEditing] = useState<CampaignEvent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CampaignEvent | null>(null);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const sorted = [...events].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return {
      upcoming: sorted.filter((e) => +new Date(e.date) >= now),
      past: sorted.filter((e) => +new Date(e.date) < now).reverse(),
    };
  }, [events]);

  const canManage = session?.role === 'admin' || session?.role === 'coordinator';

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {events.length} evento{events.length === 1 ? '' : 's'} cadastrado
          {events.length === 1 ? '' : 's'}
        </p>
        {canManage ? (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo evento
          </Button>
        ) : null}
      </div>

      <section className="space-y-3">
        <h3 className="font-display text-xl tracking-wide text-foreground">Próximos</h3>
        {upcoming.length === 0 ? (
          <EmptyState
            title="Sem eventos agendados"
            description="Adicione comícios, reuniões e visitas para organizar a agenda."
            icon={<Calendar className="h-5 w-5" />}
            action={
              canManage ? (
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4" /> Criar evento
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-2">
            {upcoming.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                canManage={canManage}
                onEdit={() => {
                  setEditing(e);
                  setSheetOpen(true);
                }}
                onDelete={() => setDeleteTarget(e)}
              />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-display text-xl tracking-wide text-muted-foreground">
            Realizados
          </h3>
          <ul className="space-y-2 opacity-70">
            {past.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                canManage={canManage}
                onEdit={() => {
                  setEditing(e);
                  setSheetOpen(true);
                }}
                onDelete={() => setDeleteTarget(e)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <EventFormSheet open={sheetOpen} onOpenChange={setSheetOpen} editing={editing} />
      <ConfirmDelete
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remover evento?"
        description={`Excluir "${deleteTarget?.title ?? ''}" da agenda.`}
        onConfirm={() => deleteTarget && collections.events.remove(deleteTarget.id)}
      />
    </div>
  );

  function EventRow({
    event,
    canManage,
    onEdit,
    onDelete,
  }: {
    event: CampaignEvent;
    canManage: boolean;
    onEdit: () => void;
    onDelete: () => void;
  }) {
    return (
      <li className="flex items-start gap-4 rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
        <div className="flex w-16 shrink-0 flex-col items-center rounded-lg border border-vortex-border bg-vortex-surface px-2 py-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {format(new Date(event.date), 'MMM', { locale: ptBR })}
          </span>
          <span className="font-display text-3xl leading-none text-primary">
            {format(new Date(event.date), 'dd')}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            {format(new Date(event.date), 'HH:mm')}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-foreground">{event.title}</p>
            <Badge variant={TYPE_VARIANT[event.type]}>{TYPE_LABEL[event.type]}</Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {event.city ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {event.city}
              </span>
            ) : null}
            {event.location ? <span>· {event.location}</span> : null}
          </p>
          {event.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
          ) : null}

          {canManage ? (
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-red-300 hover:text-red-200"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            </div>
          ) : null}
        </div>
      </li>
    );
  }
}
