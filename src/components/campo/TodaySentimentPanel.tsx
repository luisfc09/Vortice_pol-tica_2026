import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SentimentData } from '@/lib/campo-hoje';

const PP = new Intl.NumberFormat('pt-BR', {
  signDisplay: 'always',
  maximumFractionDigits: 1,
});
const PCT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 0,
});

interface Props {
  data: SentimentData;
}

export function TodaySentimentPanel({ data }: Props) {
  const max = Math.max(...data.buckets.map((b) => b.pct), 1);

  const trendIcon =
    data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus;
  const TrendIcon = trendIcon;
  const trendColor =
    data.trend === 'up' ? 'success' : data.trend === 'down' ? 'destructive' : 'outline';
  const trendLabel =
    data.trend === 'up'
      ? 'Melhorando vs ontem'
      : data.trend === 'down'
        ? 'Atenção — piorando vs ontem'
        : 'Estável vs ontem';

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Sentimento das entrevistas
          </p>
          <p className="font-display text-xl tracking-wide text-foreground">
            Distribuição de hoje
          </p>
          <p className="text-xs text-muted-foreground">
            {data.total} entrevistas hoje · {data.yesterdayTotal} ontem
          </p>
        </div>
        <Badge variant={trendColor} className="gap-1 self-start">
          <TrendIcon className="h-3 w-3" />
          {trendLabel} ({PP.format(data.favorDeltaPP)} pp)
        </Badge>
      </div>

      {data.total === 0 ? (
        <p className="rounded-lg border border-dashed border-vortex-border bg-vortex-bg/40 p-6 text-center text-sm text-muted-foreground">
          Nenhuma entrevista registrada hoje. Inicie em <strong>Campo &rarr; Nova entrevista</strong>.
        </p>
      ) : (
        <div className="space-y-3">
          {data.buckets.map((b) => {
            const widthPct = (b.pct / max) * 100; // normaliza pro maior bucket
            const deltaStr = Math.abs(b.delta) < 1 ? '0 pp' : PP.format(b.delta) + ' pp';
            const deltaCls =
              b.delta > 1
                ? 'text-emerald-300'
                : b.delta < -1
                  ? 'text-red-300'
                  : 'text-muted-foreground';
            return (
              <div key={b.intention} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{b.label}</span>
                  <span className="text-muted-foreground">
                    {b.count} · {PCT.format(b.pct / 100)}{' '}
                    <span className={deltaCls}>({deltaStr})</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-vortex-bg">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: b.color,
                      boxShadow: `0 0 12px ${b.color}55`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
