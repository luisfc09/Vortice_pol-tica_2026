import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Calendar, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/data/EmptyState';
import { ConfirmDelete } from '@/components/data/ConfirmDelete';
import { EventFormSheet } from '@/components/events/EventFormSheet';
import { AgendaCalendar } from '@/components/events/AgendaCalendar';
import { OpenInMapsButton } from '@/components/maps/OpenInMapsButton';
import { collections, useCollection } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';
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

type View = 'lista' | 'mes' | 'semana';
const VIEW_LABEL: Record<View, string> = { lista: 'Lista', mes: 'Mês', semana: 'Semana' };

export default function AgendaPage() {
  const session = useAuthStore((s) => s.session);
  const events = useCollection(collections.events);
  const [editing, setEditing] = useState<CampaignEvent | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CampaignEvent | null>(null);
  const [view, setView] = useState<View>('mes');
  const [cursor, setCursor] = useState<Date>(() => new Date());

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const sorted = [...events].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return {
      upcoming: sorted.filter((e) => +new Date(e.date) >= now),
      past: sorted.filter((e) => +new Date(e.date) < now).reverse(),
    };
  }, [events]);

  const canManage = session?.role === 'admin' || session?.role === 'coordinator';

  function openNew(date?: Date) {
    setEditing(null);
    setInitialDate(date ?? null);
    setSheetOpen(true);
  }
  function openEdit(e: CampaignEvent) {
    setEditing(e);
    setInitialDate(null);
    setSheetOpen(true);
  }

  function shift(dir: -1 | 1) {
    setCursor((c) =>
      view === 'semana'
        ? dir < 0 ? subWeeks(c, 1) : addWeeks(c, 1)
        : dir < 0 ? subMonths(c, 1) : addMonths(c, 1),
    );
  }

  const periodLabel = useMemo(() => {
    if (view === 'mes') return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
    if (view === 'semana') {
      const s = startOfWeek(cursor, { weekStartsOn: 0 });
      const e = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(s, 'dd MMM', { locale: ptBR })} – ${format(e, 'dd MMM', { locale: ptBR })}`;
    }
    return '';
  }, [view, cursor]);

  return (
    <div className="space-y-5">
      {/* Barra de controle: navegação (calendário) + toggle de visão + novo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-h-9 items-center gap-2">
          {view === 'lista' ? (
            <p className="text-sm text-muted-foreground">
              {events.length} evento{events.length === 1 ? '' : 's'} cadastrado
              {events.length === 1 ? '' : 's'}
            </p>
          ) : (
            <>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
                Hoje
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Próximo">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-1 font-display text-lg capitalize tracking-wide text-foreground">
                {periodLabel}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-vortex-border p-0.5">
            {(['lista', 'mes', 'semana'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  view === v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
          {canManage ? (
            <Button onClick={() => openNew()}>
              <Plus className="h-4 w-4" /> Novo
            </Button>
          ) : null}
        </div>
      </div>

      {/* Conteúdo por visão */}
      {view === 'lista' ? (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="font-display text-xl tracking-wide text-foreground">Próximos</h3>
            {upcoming.length === 0 ? (
              <EmptyState
                title="Sem eventos agendados"
                description="Adicione comícios, reuniões e visitas para organizar a agenda."
                icon={<Calendar className="h-5 w-5" />}
                action={
                  canManage ? (
                    <Button onClick={() => openNew()}>
                      <Plus className="h-4 w-4" /> Criar evento
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="space-y-2">
                {upcoming.map((e) => (
                  <EventRow key={e.id} event={e} canManage={canManage} onEdit={() => openEdit(e)} onDelete={() => setDeleteTarget(e)} />
                ))}
              </ul>
            )}
          </section>

          {past.length > 0 ? (
            <section className="space-y-3">
              <h3 className="font-display text-xl tracking-wide text-muted-foreground">Realizados</h3>
              <ul className="space-y-2 opacity-70">
                {past.map((e) => (
                  <EventRow key={e.id} event={e} canManage={canManage} onEdit={() => openEdit(e)} onDelete={() => setDeleteTarget(e)} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <AgendaCalendar
          events={events}
          mode={view}
          cursor={cursor}
          canManage={canManage}
          onEventClick={openEdit}
          onDayCreate={openNew}
          onShowMore={(d) => {
            setCursor(d);
            setView('semana');
          }}
        />
      )}

      <EventFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        initialDate={initialDate}
      />
      <ConfirmDelete
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remover evento?"
        description={`Excluir "${deleteTarget?.title ?? ''}" da agenda.`}
        onConfirm={() => deleteTarget && collections.events.remove(deleteTarget.id)}
      />
    </div>
  );
}

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

        <div className="mt-3 flex flex-wrap gap-2">
          {canManage ? (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          ) : null}
          <OpenInMapsButton
            target={{
              logradouro: event.location,
              cidade: event.city,
              uf: 'MG',
            }}
          />
          {canManage ? (
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-300 hover:text-red-200">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
