import { AlertTriangle, Lightbulb, Sparkles, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Opportunity, RiskAlert, StrategicInsight } from '@/types';

interface Props {
  insights: StrategicInsight[];
  risks: RiskAlert[];
  opportunities: Opportunity[];
  limit?: number;
}

const IMPACT_TONE: Record<string, string> = {
  alto: 'border-vortex-lime/50 bg-vortex-lime/10 text-vortex-lime',
  medio: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  baixo: 'border-vortex-border bg-vortex-bg/40 text-muted-foreground',
};
const SEV_TONE: Record<string, string> = {
  critico: 'border-red-500/50 bg-red-500/15 text-red-200',
  alto: 'border-red-500/40 bg-red-500/10 text-red-200',
  medio: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
};

export function InsightsIA({ insights, risks, opportunities, limit }: Props) {
  const top = limit ? insights.slice(0, limit) : insights;
  if (insights.length + risks.length + opportunities.length === 0) {
    return (
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 text-sm text-muted-foreground">
        Os insights estratégicos da IA aparecem aqui após a primeira análise.
        Clique em <strong className="text-foreground">"Atualizar análise"</strong>{' '}
        no topo da página.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {top.map((insight, idx) => (
        <div
          key={`insight-${idx}`}
          className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Target className="mt-0.5 h-4 w-4 text-vortex-lime" />
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Insight · {insight.categoria}
                </p>
                <p className="font-semibold text-foreground">{insight.titulo}</p>
              </div>
            </div>
            <Badge variant="outline" className={IMPACT_TONE[insight.impacto]}>
              Impacto {insight.impacto}
            </Badge>
          </div>
          <p className="text-sm text-foreground/90">{insight.insight}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Dado: {insight.dado_de_suporte}
          </p>
        </div>
      ))}

      {risks.map((r, idx) => (
        <div
          key={`risk-${idx}`}
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-4"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-red-300" />
              <div>
                <p className="text-xs uppercase tracking-widest text-red-200/80">
                  Risco identificado
                </p>
                <p className="font-semibold text-red-100">{r.alerta}</p>
              </div>
            </div>
            <Badge variant="outline" className={SEV_TONE[r.severidade]}>
              {r.severidade}
            </Badge>
          </div>
          <p className="text-sm text-red-100/90">{r.evidencia}</p>
          <p className="mt-2 text-xs text-red-100/80">
            Mitigar: {r.acao_mitigadora}
          </p>
        </div>
      ))}

      {opportunities.map((o, idx) => (
        <div
          key={`opp-${idx}`}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4"
        >
          <div className="mb-2 flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 text-emerald-300" />
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-emerald-200/80">
                Oportunidade · {o.potencial_votos}
              </p>
              <p className="font-semibold text-emerald-100">{o.oportunidade}</p>
            </div>
          </div>
          <p className="text-sm text-emerald-100/90">{o.como_capturar}</p>
          <p className="mt-2 text-xs text-emerald-100/80">Prazo: {o.prazo}</p>
        </div>
      ))}
    </div>
  );
}
