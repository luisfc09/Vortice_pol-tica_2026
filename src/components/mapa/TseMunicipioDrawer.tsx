import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { colorForParty, situacaoBadgeVariant } from '@/lib/tseGeo';
import type { TseMunicipioRanking } from '@/lib/tseApi';

const fmt = new Intl.NumberFormat('pt-BR');

interface TseMunicipioDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ranking: TseMunicipioRanking | null;
  loading: boolean;
  error: string | null;
  cargoLabel: string;
  ano: number;
  turno: number;
}

export function TseMunicipioDrawer({
  open,
  onOpenChange,
  ranking,
  loading,
  error,
  cargoLabel,
  ano,
  turno,
}: TseMunicipioDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-5">
          <SheetTitle className="font-display text-3xl tracking-wide">
            {ranking?.municipio ?? (loading ? 'Carregando…' : 'Município')}
          </SheetTitle>
          <SheetDescription>
            {ano} · {cargoLabel}
            {turno === 2 ? ' · 2º turno' : ''}
            {ranking && !ranking.empty
              ? ` · ${fmt.format(ranking.total_votos)} votos`
              : ''}
          </SheetDescription>
        </SheetHeader>

        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Carregando ranking do município…
          </div>
        ) : !ranking || ranking.empty || ranking.candidatos.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sem resultado pra esta eleição neste município.
          </div>
        ) : (
          <ol className="space-y-1.5">
            {ranking.candidatos.map((c) => (
              <li
                key={c.sequencial}
                className="flex items-center gap-3 rounded-lg border border-vortex-border bg-vortex-surface/40 px-3 py-2"
              >
                <span className="w-5 shrink-0 text-right text-sm font-semibold text-muted-foreground">
                  {c.posicao}
                </span>
                <span
                  className="h-7 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorForParty(c.partido) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {c.nome_urna || c.candidato}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{c.partido ?? '—'}</span>
                    <span>·</span>
                    <span>nº {c.numero}</span>
                    {c.situacao ? (
                      <Badge
                        variant={situacaoBadgeVariant(c.situacao)}
                        className="ml-1 text-[9px]"
                      >
                        {c.situacao}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                  {fmt.format(c.votos)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </SheetContent>
    </Sheet>
  );
}
