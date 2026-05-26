import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import type { RegionStat } from '@/lib/metrics';

const NUM = new Intl.NumberFormat('pt-BR');

interface Props {
  data: RegionStat[];
}

export function RegionVotesChart({ data }: Props) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Por região
          </p>
          <p className="font-display text-xl tracking-wide text-foreground">
            Meta de votos
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-vortex-violet" />
            <span className="text-muted-foreground">Meta</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-vortex-lime" />
            <span className="text-muted-foreground">Estimativa</span>
          </span>
        </div>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#1A2540" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="region"
              stroke="#5C6B91"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#5C6B91"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F1629',
                border: '1px solid #1A2540',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#fff' }}
              formatter={(v: number) => NUM.format(v)}
            />
            <Bar dataKey="target" fill="#A78BFA" radius={[4, 4, 0, 0]} />
            <Bar dataKey="estimate" fill="#A3E635" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
