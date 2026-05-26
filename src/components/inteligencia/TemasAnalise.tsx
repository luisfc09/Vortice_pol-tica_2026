import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { GOV_RATING_LABEL, type CampaignIntelligence, type GovRatings, type ThemeRow } from '@/types';

interface Props {
  themes: ThemeRow[];
  gov: GovRatings;
  sentiment: CampaignIntelligence['sentiment_analysis'];
}

const THEME_COLOR = '#A3E635';

function ratingTone(value: number | null) {
  if (value === null) return 'text-muted-foreground';
  if (value < 2.5) return 'text-red-300';
  if (value < 3.5) return 'text-amber-300';
  return 'text-emerald-300';
}
function ratingIcon(value: number | null) {
  if (value === null) return '—';
  if (value < 2.5) return '🔴';
  if (value < 3.5) return '⚠️';
  return '🟢';
}

function describeRating(v: number | null): string {
  if (v === null) return 'sem dados';
  // Inverte o numeric (1..5) para o label de governo.
  if (v < 1.5) return GOV_RATING_LABEL.pessimo;
  if (v < 2.5) return GOV_RATING_LABEL.ruim;
  if (v < 3.5) return GOV_RATING_LABEL.regular;
  if (v < 4.5) return GOV_RATING_LABEL.bom;
  return GOV_RATING_LABEL.otimo;
}

export function TemasAnalise({ themes, gov, sentiment }: Props) {
  const top = themes.slice(0, 8);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
        <h3 className="font-display text-lg tracking-wide text-foreground">
          Temas mais citados
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Top 8 temas prioritários nas entrevistas
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ left: 0, right: 16 }}>
              <XAxis type="number" stroke="#64748B" fontSize={11} />
              <YAxis
                type="category"
                dataKey="theme"
                stroke="#94A3B8"
                fontSize={11}
                width={130}
              />
              <Tooltip
                formatter={(value, _name, props) => [
                  `${value} (${props.payload.pct}%)`,
                  'Citações',
                ]}
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {top.map((t) => (
                  <Cell key={t.theme} fill={THEME_COLOR} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {sentiment ? (
          <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            <p className="font-semibold uppercase tracking-widest">Sentimento por tema</p>
            {top.slice(0, 4).map((t) => {
              const s = sentiment[t.theme];
              if (!s) return null;
              const sum = s.positivo + s.neutro + s.negativo;
              if (!sum) return null;
              return (
                <div key={t.theme} className="flex items-center gap-2">
                  <span className="w-32 truncate text-foreground/80">{t.theme}</span>
                  <Bar3 positivo={s.positivo} neutro={s.neutro} negativo={s.negativo} />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
        <h3 className="font-display text-lg tracking-wide text-foreground">
          Avaliação dos governos
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Média 1–5 nas respostas do bloco governo (1 = péssimo, 5 = ótimo)
        </p>

        <div className="space-y-3 text-sm">
          {[
            { label: 'Governo estadual', value: gov.state },
            { label: 'Governo federal', value: gov.federal },
            { label: 'Prefeitura local', value: gov.city },
          ].map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-foreground">{row.label}</span>
                <span className={ratingTone(row.value)}>
                  {ratingIcon(row.value)}{' '}
                  {row.value !== null
                    ? `${row.value.toFixed(1)}/5 · ${describeRating(row.value)}`
                    : '—'}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-vortex-bg/60">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400"
                  style={{
                    width:
                      row.value !== null ? `${(row.value / 5) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {gov.state !== null && gov.federal !== null && gov.city !== null ? (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100/90">
            → Eleitor insatisfeito com{' '}
            {[
              gov.state && gov.state < 3 ? 'estadual' : null,
              gov.federal && gov.federal < 3 ? 'federal' : null,
              gov.city && gov.city < 3 ? 'prefeitura' : null,
            ]
              .filter(Boolean)
              .join(', ') || 'todos os governos a níveis aceitáveis'}
            .
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Bar3({ positivo, neutro, negativo }: { positivo: number; neutro: number; negativo: number }) {
  const total = positivo + neutro + negativo || 1;
  return (
    <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-vortex-bg/60">
      <div
        className="h-full bg-emerald-500"
        style={{ width: `${(positivo / total) * 100}%` }}
      />
      <div
        className="h-full bg-slate-500"
        style={{ width: `${(neutro / total) * 100}%` }}
      />
      <div
        className="h-full bg-red-500"
        style={{ width: `${(negativo / total) * 100}%` }}
      />
    </div>
  );
}
