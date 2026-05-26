import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { EngagementSlice } from '@/lib/metrics';

const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

interface Props {
  slices: EngagementSlice[];
  totalLabel: string;
}

export function EngagementDonut({ slices, totalLabel }: Props) {
  const total = slices.reduce((acc, s) => acc + s.value, 0) || 1;

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Engajamento por canal
      </p>
      <p className="font-display text-xl tracking-wide text-foreground">Indicadores</p>

      <div className="mt-2 flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                innerRadius={48}
                outerRadius={75}
                paddingAngle={2}
                stroke="none"
              >
                {slices.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="font-display text-3xl tracking-wide text-foreground">
              {slices[0]?.label === 'Sem atividade ainda'
                ? '—'
                : PCT.format((slices[0]?.value ?? 0) / total)}
            </p>
            <p className="text-[11px] text-muted-foreground">{totalLabel}</p>
          </div>
        </div>

        <ul className="flex-1 space-y-2 text-sm">
          {slices.map((s) => {
            const ratio = s.value / total;
            return (
              <li key={s.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-foreground/80">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {s.label === 'Sem atividade ainda' ? '—' : PCT.format(ratio)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
