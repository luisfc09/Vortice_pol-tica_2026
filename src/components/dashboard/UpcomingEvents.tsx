import { Link } from 'react-router-dom';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collections, useCollection } from '@/lib/data';
import { Button } from '@/components/ui/button';

export function UpcomingEvents() {
  const events = useCollection(collections.events);
  const now = Date.now();
  const upcoming = events
    .filter((e) => +new Date(e.date) >= now)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .slice(0, 5);

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 backdrop-blur">
      <div className="flex items-center justify-between border-b border-vortex-border px-5 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Agenda
          </p>
          <p className="font-display text-2xl tracking-wide text-foreground">Próximos eventos</p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/agenda">
            Ver tudo <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <ul className="divide-y divide-vortex-border">
        {upcoming.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted-foreground">
            Sem eventos agendados.
          </li>
        ) : (
          upcoming.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-5 py-3">
              <div className="flex w-14 shrink-0 flex-col items-center rounded-lg border border-vortex-border bg-vortex-surface px-2 py-1.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {format(new Date(e.date), 'MMM', { locale: ptBR })}
                </span>
                <span className="font-display text-2xl leading-none text-primary">
                  {format(new Date(e.date), 'dd', { locale: ptBR })}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{e.title}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(e.date), "HH:mm", { locale: ptBR })}
                  {e.city ? (
                    <>
                      <MapPin className="ml-1 h-3 w-3" />
                      {e.city}
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
