import { Link } from 'react-router-dom';
import { ArrowRight, Brain, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIntelligence } from '@/hooks/useIntelligence';
import { RELIABILITY_LABEL } from '@/types';

export function IntelligenceTeaser() {
  const { intelligence, ai_filled, sample } = useIntelligence();

  const insights = intelligence.strategic_insights.slice(0, 2);
  const opportunities = intelligence.opportunities.slice(0, 1);

  return (
    <div className="rounded-xl border border-vortex-lime/40 bg-gradient-to-br from-vortex-lime/8 to-violet-500/5 p-4 backdrop-blur">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-vortex-lime" />
            <p className="font-display text-lg tracking-wide text-foreground">
              Inteligência Eleitoral
            </p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {sample.total} entrevistas · {RELIABILITY_LABEL[sample.reliability]}
            {ai_filled ? ' · análise IA disponível' : ' · análise IA pendente'}
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/inteligencia">
            Abrir painel completo
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {intelligence.resumo_executivo ? (
        <p className="mb-3 text-sm text-foreground/90">
          {intelligence.resumo_executivo}
        </p>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">
          Acione a análise IA pra gerar resumo executivo, insights e agenda
          recomendada com base nas entrevistas.
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {insights.map((it, idx) => (
          <div
            key={idx}
            className="rounded-md border border-vortex-border bg-vortex-bg/30 p-2.5 text-xs"
          >
            <div className="mb-1 flex items-center gap-1.5">
              <Target className="h-3 w-3 text-vortex-lime" />
              <p className="truncate font-semibold text-foreground">{it.titulo}</p>
              <Badge variant="outline" className="ml-auto text-[10px]">
                {it.impacto}
              </Badge>
            </div>
            <p className="line-clamp-2 text-muted-foreground">{it.insight}</p>
          </div>
        ))}
        {opportunities.map((o, idx) => (
          <div
            key={`o-${idx}`}
            className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs"
          >
            <div className="mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-emerald-300" />
              <p className="truncate font-semibold text-emerald-100">
                Oportunidade: {o.potencial_votos}
              </p>
            </div>
            <p className="line-clamp-2 text-emerald-100/80">{o.oportunidade}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
