import { useMemo, useState } from 'react';
import { Search, Trophy, MapPin, Vote } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  buildPartyLegend,
  colorForParty,
  situacaoBadgeVariant,
} from '@/lib/tseGeo';
import type { TseCandidato, TseMapaResposta } from '@/lib/tseApi';

const fmt = new Intl.NumberFormat('pt-BR');

interface TseResumoPanelProps {
  mapa: TseMapaResposta | null;
  candidatos: TseCandidato[];
  loading: boolean;
  error: string | null;
  onSelectMunicipioByName?: (nome: string) => void;
}

export function TseResumoPanel({
  mapa,
  candidatos,
  loading,
  error,
}: TseResumoPanelProps) {
  const [search, setSearch] = useState('');

  const totalVotos = useMemo(
    () => (mapa ? mapa.municipios.reduce((s, m) => s + m.total_votos, 0) : 0),
    [mapa],
  );

  const partyLegend = useMemo(
    () =>
      mapa ? buildPartyLegend(mapa.municipios.map((m) => m.lider.partido)).slice(0, 12) : [],
    [mapa],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidatos;
    return candidatos.filter(
      (c) =>
        c.candidato.toLowerCase().includes(q) ||
        (c.nome_urna ?? '').toLowerCase().includes(q) ||
        (c.partido ?? '').toLowerCase().includes(q) ||
        c.numero.includes(q),
    );
  }, [candidatos, search]);

  const lider = candidatos[0] ?? null;

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        <p className="font-medium">Não foi possível carregar os dados do TSE.</p>
        <p className="mt-1 text-xs opacity-80">{error}</p>
        <p className="mt-2 text-xs opacity-80">
          Verifique se o backend está no ar (VITE_BACKEND_URL) e se as migrations 023–025
          foram aplicadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<MapPin className="h-4 w-4" />}
          label="Municípios com resultado"
          value={mapa ? fmt.format(mapa.total_municipios) : '—'}
          loading={loading}
        />
        <SummaryCard
          icon={<Vote className="h-4 w-4" />}
          label="Total de votos (estado)"
          value={mapa ? fmt.format(totalVotos) : '—'}
          loading={loading}
        />
        <SummaryCard
          icon={<Trophy className="h-4 w-4" />}
          label="Mais votado no estado"
          value={lider ? (lider.nome_urna || lider.candidato) : '—'}
          sub={lider ? `${lider.partido ?? '—'} · ${fmt.format(lider.votos)} votos` : undefined}
          loading={loading}
        />
      </div>

      {/* Legenda de partidos líderes */}
      {partyLegend.length > 0 ? (
        <div className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Partido líder por município
          </p>
          <div className="flex flex-wrap gap-2">
            {partyLegend.map((p) => (
              <span
                key={p.sigla}
                className="inline-flex items-center gap-1.5 rounded-full border border-vortex-border bg-vortex-bg px-2.5 py-1 text-xs"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.sigla}
                <span className="text-muted-foreground">· {p.count}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Ranking estadual de candidatos */}
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/40">
        <div className="flex items-center justify-between gap-3 border-b border-vortex-border p-3">
          <p className="text-sm font-medium text-foreground">
            Ranking estadual de candidatos
          </p>
          <div className="relative w-full max-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar candidato, partido, nº"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Carregando candidatos…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {candidatos.length === 0
              ? 'Selecione uma eleição para ver o ranking.'
              : 'Nenhum candidato corresponde à busca.'}
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-vortex-surface text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Candidato</th>
                  <th className="px-3 py-2 text-left font-medium">Partido</th>
                  <th className="px-3 py-2 text-right font-medium">Votos</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Mun.</th>
                  <th className="hidden px-3 py-2 text-left font-medium md:table-cell">Situação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map((c, i) => (
                  <tr
                    key={c.sequencial}
                    className="border-t border-vortex-border/60 hover:bg-vortex-bg/40"
                  >
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">
                        {c.nome_urna || c.candidato}
                      </div>
                      {c.nome_urna && c.nome_urna !== c.candidato ? (
                        <div className="text-[11px] text-muted-foreground">{c.candidato}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: colorForParty(c.partido) }}
                        />
                        <span className="text-xs">{c.partido ?? '—'}</span>
                        <span className="text-[11px] text-muted-foreground">{c.numero}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {fmt.format(c.votos)}
                    </td>
                    <td className="hidden px-3 py-2 text-right text-muted-foreground tabular-nums sm:table-cell">
                      {c.municipios}
                    </td>
                    <td className="hidden px-3 py-2 md:table-cell">
                      {c.situacao ? (
                        <Badge variant={situacaoBadgeVariant(c.situacao)} className="text-[10px]">
                          {c.situacao}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="truncate font-display text-xl text-foreground">
        {loading ? '…' : value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
