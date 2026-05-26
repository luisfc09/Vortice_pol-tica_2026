import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { RadarPoint } from '@/lib/pulse';

interface Props {
  data: RadarPoint[];
}

export function WeeklyRadar({ data }: Props) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Radar semanal
          </p>
          <p className="font-display text-xl tracking-wide text-foreground">
            6 dimensões — atual vs semana anterior
          </p>
        </div>
      </div>

      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
            <PolarGrid stroke="#1A2540" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: '#94A3B8', fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#475569', fontSize: 10 }}
              tickCount={5}
              stroke="#1A2540"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F1629',
                border: '1px solid #1A2540',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number) => `${Math.round(value)}/100`}
            />
            <Radar
              name="Semana anterior"
              dataKey="previous"
              stroke="#A78BFA"
              strokeWidth={2}
              fill="#A78BFA"
              fillOpacity={0.2}
            />
            <Radar
              name="Esta semana"
              dataKey="current"
              stroke="#A3E635"
              strokeWidth={2}
              fill="#A3E635"
              fillOpacity={0.3}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              iconType="circle"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
