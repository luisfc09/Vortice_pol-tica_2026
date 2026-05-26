import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DistributionItem } from '@/types';

interface Props {
  data: DistributionItem[];
}

// Cores alinhadas ao gradient do mapa: oposição → indeciso → apoio
const COLOR_BY_LABEL: Record<string, string> = {
  Apoiador: '#A3E635',
  'Tendência a apoiar': '#84CC16',
  Indeciso: '#F59E0B',
  'Tendência à oposição': '#EF4444',
  Oposição: '#B91C1C',
};
const FALLBACK = ['#A3E635', '#84CC16', '#F59E0B', '#EF4444', '#B91C1C', '#475569'];

export function DistribuicaoVotos({ data }: Props) {
  const total = data.reduce((a, b) => a + b.count, 0);
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
      <h3 className="font-display text-lg tracking-wide text-foreground">
        Distribuição de intenção
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        {total} respostas válidas
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={80}
                paddingAngle={1}
              >
                {data.map((d, idx) => (
                  <Cell
                    key={d.label}
                    fill={COLOR_BY_LABEL[d.label] ?? FALLBACK[idx % FALLBACK.length]}
                    stroke="#0A0F1E"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, props) => [
                  `${value} (${props.payload.pct}%)`,
                  props.payload.label,
                ]}
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="space-y-1.5 self-center text-sm">
          {data.map((d, idx) => (
            <li key={d.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      COLOR_BY_LABEL[d.label] ?? FALLBACK[idx % FALLBACK.length],
                  }}
                />
                <span className="text-foreground">{d.label}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {d.pct}% ({d.count})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
