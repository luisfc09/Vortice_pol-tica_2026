import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, Vote, MapPin } from 'lucide-react';
import { VOTE_INTENTION_COLOR, VOTE_INTENTION_LABEL, type Supporter, type Voter } from '@/types';
import { cn } from '@/lib/utils';

interface MunicipalityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string | null;
  population: number;
  supporters: Supporter[];
  voters: Voter[];
  strength: number;
}

export function MunicipalityDrawer({
  open,
  onOpenChange,
  name,
  population,
  supporters,
  voters,
  strength,
}: MunicipalityDrawerProps) {
  const intentionBreakdown = voters.reduce(
    (acc, v) => {
      acc[v.vote_intention] = (acc[v.vote_intention] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-5">
          <SheetTitle className="font-display text-3xl tracking-wide">{name}</SheetTitle>
          <SheetDescription>
            População aproximada: {new Intl.NumberFormat('pt-BR').format(population)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Força política
              </p>
              <Badge variant={strength >= 0.5 ? 'success' : strength >= 0.3 ? 'warning' : 'destructive'}>
                {Math.round(strength * 100)}%
              </Badge>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-vortex-bg">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-vortex-lime"
                style={{ width: `${Math.min(100, Math.round(strength * 100))}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Combina capilaridade da base e adesão dos eleitores ouvidos.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Lideranças" value={supporters.length} icon={<Users className="h-4 w-4" />} />
            <Stat label="Eleitores" value={voters.length} icon={<UserCheck className="h-4 w-4" />} />
            <Stat
              label="Apoiadores"
              value={voters.filter((v) => v.vote_intention === 'apoiador').length}
              icon={<Vote className="h-4 w-4" />}
            />
            <Stat
              label="Indecisos"
              value={voters.filter((v) => v.vote_intention === 'indeciso').length}
              icon={<MapPin className="h-4 w-4" />}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Distribuição de intenção
            </p>
            <div className="space-y-1.5">
              {(Object.keys(VOTE_INTENTION_LABEL) as Array<keyof typeof VOTE_INTENTION_LABEL>).map((k) => {
                const count = intentionBreakdown[k] ?? 0;
                return (
                  <div
                    key={k}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
                      VOTE_INTENTION_COLOR[k],
                    )}
                  >
                    <span>{VOTE_INTENTION_LABEL[k]}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {supporters.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Lideranças locais ({supporters.length})
              </p>
              <ul className="space-y-1 text-sm">
                {supporters.slice(0, 8).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-vortex-border bg-vortex-surface/40 px-3 py-2"
                  >
                    <span className="truncate text-foreground">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="font-display text-2xl text-foreground">{value}</p>
    </div>
  );
}
