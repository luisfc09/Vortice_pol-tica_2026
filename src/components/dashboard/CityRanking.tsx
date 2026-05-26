import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CityRankRow } from '@/lib/metrics';

const NUM = new Intl.NumberFormat('pt-BR');

interface Props {
  rows: CityRankRow[];
}

export function CityRanking({ rows }: Props) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 backdrop-blur">
      <div className="flex items-center justify-between border-b border-vortex-border px-5 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Top municípios
          </p>
          <p className="font-display text-xl tracking-wide text-foreground">Ranking</p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/mapa">
            Ver mapa <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Sem cidades pontuadas ainda.
        </p>
      ) : (
        <ul className="divide-y divide-vortex-border">
          {rows.map((r, idx) => (
            <li key={r.code} className="flex items-center gap-3 px-5 py-3 text-sm">
              <span
                className={
                  idx === 0
                    ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-vortex-lime/20 font-bold text-vortex-lime'
                    : idx === 1
                      ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-vortex-violet/20 font-bold text-vortex-violet'
                      : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-vortex-surface font-semibold text-muted-foreground'
                }
              >
                {idx + 1}
              </span>
              <p className="flex-1 truncate text-foreground">{r.name}</p>
              <span className="text-xs font-medium text-foreground/80">{NUM.format(r.score)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
