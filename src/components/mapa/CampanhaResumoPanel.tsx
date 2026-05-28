import { useMemo, useState } from 'react';
import { Search, Users, UserCheck, MapPin, Vote } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { MuniStat } from '@/data/municipalities-mg-coords';

const fmt = new Intl.NumberFormat('pt-BR');

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function forcaBadgeVariant(strength: number): 'success' | 'warning' | 'destructive' {
  if (strength >= 0.5) return 'success';
  if (strength >= 0.3) return 'warning';
  return 'destructive';
}

interface CampanhaResumoPanelProps {
  stats: MuniStat[];
  onSelect: (code: string) => void;
}

// Espelha o TseResumoPanel, mas com dados da campanha (lideranças, eleitores,
// força) em vez de votos do TSE: cards-resumo + ranking de municípios clicável.
export function CampanhaResumoPanel({ stats, onSelect }: CampanhaResumoPanelProps) {
  const [search, setSearch] = useState('');

  const totais = useMemo(() => {
    let lid = 0;
    let ele = 0;
    let apo = 0;
    let cobertos = 0;
    for (const s of stats) {
      lid += s.supporters;
      ele += s.voters;
      apo += s.apoiadores;
      if (s.supporters > 0 || s.voters > 0) cobertos += 1;
    }
    return { lid, ele, apo, cobertos };
  }, [stats]);

  // Ranking: por padrão só municípios com base (≥1 cadastro), ordenados por
  // força. Ao buscar, varre os 853.
  const ranking = useMemo(() => {
    const q = norm(search.trim());
    const base = q
      ? stats.filter((s) => norm(s.name).includes(q))
      : stats.filter((s) => s.supporters > 0 || s.voters > 0);
    return [...base]
      .sort((a, b) => b.strength - a.strength || b.supporters - a.supporters)
      .slice(0, 300);
  }, [stats, search]);

  const topMuni = useMemo(
    () =>
      stats.reduce<MuniStat | null>(
        (best, s) => (!best || s.strength > best.strength ? s : best),
        null,
      ),
    [stats],
  );

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label="Lideranças"
          value={fmt.format(totais.lid)}
        />
        <SummaryCard
          icon={<UserCheck className="h-4 w-4" />}
          label="Eleitores ouvidos"
          value={fmt.format(totais.ele)}
        />
        <SummaryCard
          icon={<Vote className="h-4 w-4" />}
          label="Apoiadores"
          value={fmt.format(totais.apo)}
        />
        <SummaryCard
          icon={<MapPin className="h-4 w-4" />}
          label="Municípios com base"
          value={`${fmt.format(totais.cobertos)} / 853`}
          sub={topMuni && topMuni.strength > 0 ? `Mais forte: ${topMuni.name}` : undefined}
        />
      </div>

      {/* Ranking de municípios */}
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/40">
        <div className="flex items-center justify-between gap-3 border-b border-vortex-border p-3">
          <p className="text-sm font-medium text-foreground">Municípios por força da campanha</p>
          <div className="relative w-full max-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar município"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        {ranking.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {search
              ? 'Nenhum município corresponde à busca.'
              : 'Nenhum município com cadastros ainda. Cadastre lideranças e eleitores pra ver o ranking.'}
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-vortex-surface text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Município</th>
                  <th className="px-3 py-2 text-right font-medium">Lideranças</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Eleitores</th>
                  <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Apoiadores</th>
                  <th className="px-3 py-2 text-right font-medium">Força</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((s, i) => (
                  <tr
                    key={s.code}
                    onClick={() => onSelect(s.code)}
                    className="cursor-pointer border-t border-vortex-border/60 hover:bg-vortex-bg/40"
                  >
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{s.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.supporters}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                      {s.voters}
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">
                      {s.apoiadores}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant={forcaBadgeVariant(s.strength)} className="text-[10px]">
                        {Math.round(s.strength * 100)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="truncate font-display text-xl text-foreground">{value}</p>
      {sub ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
