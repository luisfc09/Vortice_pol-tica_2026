import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface ChartPoint {
  date: string;
  supporters: number;
  voters: number;
}

interface RegistrationChartProps {
  data: ChartPoint[];
  periodLabel: string;
}

export function RegistrationChart({ data, periodLabel }: RegistrationChartProps) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {periodLabel}
          </p>
          <p className="font-display text-xl tracking-wide text-foreground">
            Evolução de cadastros
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-vortex-lime" />
            <span className="text-muted-foreground">Lideranças</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-vortex-violet" />
            <span className="text-muted-foreground">Eleitores</span>
          </span>
        </div>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="g-supporters" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A3E635" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#A3E635" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g-voters" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#A78BFA" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1A2540" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
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
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F1629',
                border: '1px solid #1A2540',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#fff' }}
            />
            <Area
              type="monotone"
              dataKey="supporters"
              stroke="#A3E635"
              strokeWidth={2}
              fill="url(#g-supporters)"
              name="Lideranças"
            />
            <Area
              type="monotone"
              dataKey="voters"
              stroke="#A78BFA"
              strokeWidth={2}
              fill="url(#g-voters)"
              name="Eleitores"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
