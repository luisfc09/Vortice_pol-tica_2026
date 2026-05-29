import { useMemo } from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { CampaignEvent, EventType } from '@/types';

// Cor do "pontinho" por tipo de evento (combina com os badges da lista).
const TYPE_DOT: Record<EventType, string> = {
  comicio: 'bg-primary',
  reuniao: 'bg-vortex-violet',
  visita: 'bg-emerald-400',
  midia: 'bg-amber-400',
  outro: 'bg-slate-400',
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function dayKey(d: Date | string): string {
  return format(new Date(d), 'yyyy-MM-dd');
}

interface Props {
  events: CampaignEvent[];
  mode: 'mes' | 'semana';
  cursor: Date;
  canManage: boolean;
  onEventClick: (e: CampaignEvent) => void;
  onDayCreate: (d: Date) => void;
  onShowMore: (d: Date) => void;
}

export function AgendaCalendar({
  events,
  mode,
  cursor,
  canManage,
  onEventClick,
  onDayCreate,
  onShowMore,
}: Props) {
  const byDay = useMemo(() => {
    const m = new Map<string, CampaignEvent[]>();
    for (const e of events) {
      const k = dayKey(e.date);
      const arr = m.get(k) ?? [];
      arr.push(e);
      m.set(k, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return m;
  }, [events]);

  const days = useMemo(() => {
    if (mode === 'semana') {
      return eachDayOfInterval({
        start: startOfWeek(cursor, { weekStartsOn: 0 }),
        end: endOfWeek(cursor, { weekStartsOn: 0 }),
      });
    }
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
    });
  }, [mode, cursor]);

  // -------- Semana: 7 dias empilhados (mobile-first) --------
  if (mode === 'semana') {
    return (
      <div className="space-y-2">
        {days.map((d) => {
          const list = byDay.get(dayKey(d)) ?? [];
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'rounded-xl border p-3',
                isToday(d)
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-vortex-border bg-vortex-surface/40',
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium capitalize text-foreground">
                  {format(d, "EEEE, dd 'de' MMM", { locale: ptBR })}
                  {isToday(d) ? (
                    <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      hoje
                    </span>
                  ) : null}
                </p>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => onDayCreate(d)}
                    className="shrink-0 text-xs text-muted-foreground hover:text-primary"
                  >
                    + evento
                  </button>
                ) : null}
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem eventos.</p>
              ) : (
                <ul className="space-y-1">
                  {list.map((e) => (
                    <li key={e.id}>
                      <EventChip event={e} canManage={canManage} onClick={() => onEventClick(e)} showTime />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // -------- Mês: grade 7 colunas --------
  return (
    <div className="overflow-hidden rounded-xl border border-vortex-border">
      <div className="grid grid-cols-7 border-b border-vortex-border bg-vortex-surface/60">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="px-1 py-2 text-center text-[11px] uppercase tracking-widest text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(dayKey(d)) ?? [];
          const inMonth = isSameMonth(d, cursor);
          const visible = list.slice(0, 3);
          const extra = list.length - visible.length;
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'min-h-[94px] border-b border-r border-vortex-border p-1.5',
                !inMonth && 'bg-vortex-bg/30',
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    isToday(d)
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : inMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground/50',
                  )}
                >
                  {format(d, 'd')}
                </span>
                {canManage && inMonth ? (
                  <button
                    type="button"
                    onClick={() => onDayCreate(d)}
                    aria-label="Novo evento neste dia"
                    className="text-base leading-none text-muted-foreground/60 hover:text-primary"
                  >
                    +
                  </button>
                ) : null}
              </div>
              <div className="space-y-0.5">
                {visible.map((e) => (
                  <EventChip key={e.id} event={e} canManage={canManage} onClick={() => onEventClick(e)} />
                ))}
                {extra > 0 ? (
                  <button
                    type="button"
                    onClick={() => onShowMore(d)}
                    className="w-full truncate text-left text-[10px] text-muted-foreground hover:text-primary"
                  >
                    +{extra} mais
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventChip({
  event,
  canManage,
  onClick,
  showTime,
}: {
  event: CampaignEvent;
  canManage: boolean;
  onClick: () => void;
  showTime?: boolean;
}) {
  const inner = (
    <span className="flex items-center gap-1 truncate">
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TYPE_DOT[event.type])} />
      <span className="truncate">
        {showTime ? `${format(new Date(event.date), 'HH:mm')} · ` : ''}
        {event.title}
      </span>
    </span>
  );
  const base =
    'block w-full truncate rounded bg-vortex-surface/70 px-1.5 py-0.5 text-left text-[11px] text-foreground/90';
  if (!canManage) {
    return (
      <div className={base} title={event.title}>
        {inner}
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick} title={event.title} className={cn(base, 'hover:bg-vortex-surface')}>
      {inner}
    </button>
  );
}
