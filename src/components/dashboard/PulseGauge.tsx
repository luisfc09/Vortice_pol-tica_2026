import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { pulseBandColor, type PulseScore } from '@/lib/pulse';

interface Props {
  score: PulseScore;
  updatedAt?: Date;
  onRefresh?: () => void;
}

// Gauge semicircular desenhado em SVG.
// Arco vai de 180° (esquerda) a 360° (direita), com gradiente vermelho → verde.
// Ponteiro indica a posição do score (0 = esquerda, 100 = direita).
export function PulseGauge({ score, updatedAt, onRefresh }: Props) {
  const radius = 130;
  const stroke = 22;
  const cx = 160;
  const cy = 160;
  const startAngle = 180;
  const endAngle = 360;
  const totalSpan = endAngle - startAngle;

  // Coordenadas do arco completo (background)
  const bgPath = describeArc(cx, cy, radius, startAngle, endAngle);
  // Coordenadas do arco preenchido (até score)
  const fillEnd = startAngle + (score.total / 100) * totalSpan;
  const fillPath = describeArc(cx, cy, radius, startAngle, fillEnd);

  // Ponteiro
  const needleAngle = (startAngle + (score.total / 100) * totalSpan) * (Math.PI / 180);
  const needleLength = radius - stroke / 2 - 6;
  const needleX = cx + needleLength * Math.cos(needleAngle);
  const needleY = cy + needleLength * Math.sin(needleAngle);

  const TrendIcon = score.delta > 0 ? TrendingUp : score.delta < 0 ? TrendingDown : Minus;
  const trendColor =
    score.delta > 0 ? 'text-emerald-400' : score.delta < 0 ? 'text-red-400' : 'text-muted-foreground';
  const trendLabel = score.delta === 0 ? 'estável' : score.delta > 0 ? 'acima' : 'abaixo';

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-6 backdrop-blur">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Pulso da campanha
          </p>
          <p className="font-display text-2xl tracking-wide text-foreground">
            Termômetro estratégico
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-vortex-surface hover:text-foreground"
            aria-label="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col items-center">
        <svg
          viewBox="0 0 320 200"
          className="w-full max-w-md"
          role="img"
          aria-label={`Pulso da campanha: ${score.total} de 100, ${score.bandLabel}`}
        >
          <defs>
            <linearGradient id="pulse-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="35%" stopColor="#F97316" />
              <stop offset="60%" stopColor="#F59E0B" />
              <stop offset="85%" stopColor="#A3E635" />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d={bgPath}
            stroke="#1A2540"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={fillPath}
            stroke="url(#pulse-grad)"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />

          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = (startAngle + (tick / 100) * totalSpan) * (Math.PI / 180);
            const innerR = radius - stroke / 2 - 4;
            const outerR = radius + stroke / 2 + 4;
            const x1 = cx + innerR * Math.cos(angle);
            const y1 = cy + innerR * Math.sin(angle);
            const x2 = cx + outerR * Math.cos(angle);
            const y2 = cy + outerR * Math.sin(angle);
            return (
              <line
                key={tick}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#5C6B91"
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}

          {/* Pointer */}
          <circle cx={cx} cy={cy} r={8} fill={pulseBandColor(score.band)} />
          <line
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
            stroke={pulseBandColor(score.band)}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={4} fill="#0A0F1E" />
        </svg>

        <div className="-mt-12 flex flex-col items-center">
          <p
            className="font-display text-7xl leading-none tracking-tight"
            style={{ color: pulseBandColor(score.band) }}
          >
            {score.total}
          </p>
          <p
            className="mt-1 text-sm font-semibold uppercase tracking-widest"
            style={{ color: pulseBandColor(score.band) }}
          >
            {score.bandLabel}
          </p>
          <div className={`mt-3 flex items-center gap-1.5 text-xs ${trendColor}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span>
              {score.delta === 0
                ? 'Sem variação esta semana'
                : `${score.delta > 0 ? '+' : ''}${score.delta} pontos ${trendLabel} da semana passada`}
            </span>
          </div>
        </div>

        <div className="mt-5 grid w-full grid-cols-5 gap-1.5 text-[10px] text-muted-foreground">
          {[
            { label: '0', color: '#EF4444' },
            { label: '25', color: '#F97316' },
            { label: '50', color: '#F59E0B' },
            { label: '75', color: '#A3E635' },
            { label: '100', color: '#A3E635' },
          ].map((t, i) => (
            <div key={t.label} className="flex items-center gap-1" style={{ justifyContent: i === 0 ? 'flex-start' : i === 4 ? 'flex-end' : 'center' }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
              {t.label}
            </div>
          ))}
        </div>

        {updatedAt ? (
          <p className="mt-4 text-[11px] text-muted-foreground">
            Atualizado{' '}
            {formatRelative(updatedAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Helpers --------------------------------------------------------------------

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number): string {
  const [x1, y1] = polar(cx, cy, r, start);
  const [x2, y2] = polar(cx, cy, r, end);
  const largeArc = end - start <= 180 ? 0 : 1;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function formatRelative(d: Date): string {
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'agora mesmo';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return d.toLocaleDateString('pt-BR');
}
