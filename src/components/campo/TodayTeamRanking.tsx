import { useEffect, useState } from 'react';
import { Trophy, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase, USE_MOCKS } from '@/lib/supabase';
import { initials } from '@/lib/utils';
import { SEED_TEAMMATE_PROFILES } from '@/data/seeds';
import type { AgentRankRow } from '@/lib/campo-hoje';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  rows: AgentRankRow[];
}

interface ProfileLite {
  full_name: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function TodayTeamRanking({ rows }: Props) {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      const ids = rows.map((r) => r.user_id);
      if (ids.length === 0) return;

      if (USE_MOCKS) {
        const next: Record<string, string> = {};
        for (const id of ids) {
          next[id] = SEED_TEAMMATE_PROFILES[id]?.full_name ?? `Agente ${id.slice(-4)}`;
        }
        if (active) setNames(next);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      if (!active || !data) return;
      const next: Record<string, string> = {};
      for (const row of data as Array<{ id: string; full_name: string }>) {
        next[row.id] = row.full_name;
      }
      setNames(next);
    }
    void load();
    return () => {
      active = false;
    };
  }, [rows]);

  function profileFor(userId: string): ProfileLite {
    return { full_name: names[userId] ?? `Agente ${userId.slice(-4)}` };
  }

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 backdrop-blur">
      <div className="border-b border-vortex-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-vortex-lime" />
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Ranking do dia
          </p>
        </div>
        <p className="font-display text-xl tracking-wide text-foreground">
          Top agentes em campo
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Ainda sem entrevistas hoje. Cabos eleitorais aparecem aqui assim que registrarem.
        </p>
      ) : (
        <ul className="divide-y divide-vortex-border">
          {rows.map((row, idx) => {
            const profile = profileFor(row.user_id);
            const medal = MEDALS[idx];
            const lastSpot =
              row.lastNeighborhood && row.lastMunicipalityName
                ? `${row.lastNeighborhood} · ${row.lastMunicipalityName}`
                : row.lastNeighborhood ?? row.lastMunicipalityName ?? 'Sem local';
            return (
              <li
                key={row.user_id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {medal ? <span>{medal}</span> : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-vortex-bg text-[10px] font-semibold text-muted-foreground">
                        {idx + 1}
                      </span>
                    )}
                    <p className="truncate font-semibold text-foreground">{profile.full_name}</p>
                  </div>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{lastSpot}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0">
                      última{' '}
                      {formatDistanceToNow(new Date(row.lastAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-2xl leading-none tracking-wide text-vortex-lime">
                    {row.count}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    entrevistas
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
