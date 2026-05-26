import { MessageCircle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type {
  ConversionSegmentBreakdown,
  RiskSegment,
} from '@/types';

interface Props {
  conversion: ConversionSegmentBreakdown | null;
  risks: RiskSegment[];
  messages: Record<string, string> | null;
}

export function SegmentosCard({ conversion, risks, messages }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
        <h3 className="font-display text-lg tracking-wide text-emerald-100">
          Indecisos — onde está a maior oportunidade
        </h3>
        {conversion && conversion.total > 0 ? (
          <>
            <p className="mt-1 text-xs text-emerald-200/80">
              {conversion.total} entrevistados · {conversion.pct}% do total
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <BreakdownList title="Por faixa etária" items={conversion.by_age.slice(0, 3)} />
              <BreakdownList title="Por religião" items={conversion.by_religion.slice(0, 3)} />
              <BreakdownList title="Por renda" items={conversion.by_income.slice(0, 3)} />
              <BreakdownList
                title="Temas que mais mencionam"
                items={conversion.themes.slice(0, 3).map((t) => ({
                  label: t.theme,
                  count: t.count,
                  pct: t.pct,
                }))}
              />
            </div>
            {conversion.top_conversion_argument ? (
              <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/15 p-2 text-xs text-emerald-100/90">
                <MessageCircle className="mr-1 inline h-3 w-3" />
                Argumento mais citado:{' '}
                <strong>"{conversion.top_conversion_argument}"</strong>
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-emerald-100/80">
            Sem indecisos registrados nas entrevistas atuais. Bom sinal — mas
            convém ampliar a coleta pra confirmar.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
        <h3 className="font-display text-lg tracking-wide text-red-100">
          Segmentos em risco
        </h3>
        {risks.length === 0 ? (
          <p className="mt-2 text-sm text-red-100/80">
            Nenhum segmento foi sinalizado como risco na última análise.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {risks.map((r, i) => (
              <li key={i} className="rounded-md border border-red-500/30 bg-red-500/5 p-2">
                <p className="font-semibold text-red-100">{r.segmento}</p>
                <p className="text-xs text-red-100/80">
                  {r.tamanho_pct}% · {r.motivo}
                </p>
                <p className="mt-1 text-xs">
                  <strong>Ação:</strong> {r.acao_mitigadora}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {messages ? (
        <div className="md:col-span-2 rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
          <h3 className="font-display text-lg tracking-wide text-foreground">
            Mensagens recomendadas por segmento
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            <Users className="mr-1 inline h-3 w-3" />
            Use como gabarito pra material de campanha em cada canal
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Object.entries(messages).map(([key, msg]) => (
              <div
                key={key}
                className="rounded-lg border border-vortex-border bg-vortex-bg/30 p-3"
              >
                <Badge variant="outline" className="mb-1.5">
                  {key.replace(/_/g, ' ')}
                </Badge>
                <p className="text-sm text-foreground/90">{msg}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BreakdownList({
  title,
  items,
}: {
  title: string;
  items: { label?: string; theme?: string; count: number; pct: number }[];
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-emerald-200/70">
        {title}
      </p>
      <ul className="mt-1 space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <span className="truncate text-emerald-100/90">
              {it.label ?? it.theme ?? '—'}
            </span>
            <span className="font-mono text-xs text-emerald-200/80">
              {it.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
