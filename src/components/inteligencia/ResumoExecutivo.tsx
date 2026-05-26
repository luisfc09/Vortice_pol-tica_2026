import { Brain, RefreshCcw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RELIABILITY_LABEL, type CampaignIntelligence, type IntelligenceReliability } from '@/types';

interface Props {
  intelligence: CampaignIntelligence;
  reliability: IntelligenceReliability;
  ai_filled: boolean;
  running: boolean;
  onRefresh: () => void;
}

export function ResumoExecutivo({
  intelligence,
  reliability,
  ai_filled,
  running,
  onRefresh,
}: Props) {
  const generated = new Date(intelligence.generated_at);
  const total = intelligence.total_interviews;
  const reliabilityTone: Record<IntelligenceReliability, string> = {
    preliminary: 'border-red-500/40 bg-red-500/10 text-red-200',
    partial: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    consistent: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    high: 'border-vortex-lime/50 bg-vortex-lime/10 text-vortex-lime',
    institute: 'border-vortex-lime/70 bg-vortex-lime/20 text-vortex-lime',
  };
  return (
    <div className="rounded-2xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-vortex-lime" />
            <h2 className="font-display text-xl tracking-wide text-foreground">
              Inteligência Eleitoral
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Baseado em <strong className="text-foreground">{total} entrevistas</strong>{' '}
            · última análise{' '}
            {formatDistanceToNow(generated, { addSuffix: true, locale: ptBR })} ·{' '}
            {format(generated, 'HH:mm', { locale: ptBR })}
          </p>
        </div>
        <Button onClick={onRefresh} disabled={running} size="sm">
          <RefreshCcw className={running ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          {running ? 'Analisando…' : 'Atualizar análise'}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={reliabilityTone[reliability]}>
          {RELIABILITY_LABEL[reliability]}
        </Badge>
        {!ai_filled ? (
          <Badge variant="outline" className="border-amber-500/40 text-amber-200">
            Análise IA pendente — exibindo estatísticas locais
          </Badge>
        ) : null}
        {intelligence.campaign_health_score != null ? (
          <Badge variant="outline">
            Health score: {intelligence.campaign_health_score}/100
          </Badge>
        ) : null}
        {intelligence.conversion_probability != null ? (
          <Badge variant="outline">
            Conversão: {(intelligence.conversion_probability * 100).toFixed(0)}%
          </Badge>
        ) : null}
      </div>

      {intelligence.resumo_executivo ? (
        <p className="text-sm leading-relaxed text-foreground/90">
          {intelligence.resumo_executivo}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {total < 10
            ? `Mínimo de 10 entrevistas completas para análise (atual: ${total}).`
            : 'Clique em "Atualizar análise" pra acionar o agente especialista.'}
        </p>
      )}
    </div>
  );
}
