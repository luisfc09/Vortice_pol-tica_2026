import { useEffect } from 'react';
import { Sparkles, RefreshCw, ArrowRight, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AnaliseMencao, Mention } from '@/types';

interface Props {
  mention: Mention;
  analise: AnaliseMencao | null;
  analyzing: boolean;
  onAnalyze: () => Promise<void>;
  onSkip: () => void;
  onNext: () => void;
}

export function StepAnalise({ mention, analise, analyzing, onAnalyze, onSkip, onNext }: Props) {
  // Roda análise automaticamente ao entrar (se ainda não há)
  useEffect(() => {
    if (!analise && !analyzing) {
      void onAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urgenciaColor =
    analise && analise.urgencia >= 8
      ? 'destructive'
      : analise && analise.urgencia >= 5
        ? 'warning'
        : 'secondary';

  return (
    <div className="space-y-4">
      <header>
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-vortex-violet" />
          <span className="text-xs uppercase tracking-widest text-vortex-violet">
            Passo 2 — Análise do ataque
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          A IA identifica a alegação central, dados citados, tom e urgência.
        </p>
      </header>

      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
        <p className="text-xs text-muted-foreground">Menção em análise</p>
        <p className="mt-1 text-sm text-foreground/90">"{mention.content}"</p>
      </div>

      {analyzing && !analise ? (
        <div className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-6 text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6 animate-pulse text-vortex-violet" />
          <p className="text-sm text-foreground">Consultando IA...</p>
          <p className="text-xs text-muted-foreground">
            Pode levar uns 5 segundos dependendo do provedor configurado.
          </p>
        </div>
      ) : null}

      {analise ? (
        <div className="space-y-3 rounded-xl border border-vortex-violet/40 bg-vortex-violet/10 p-4 backdrop-blur">
          <Row label="Alegação central" value={analise.alegacao_central} highlight />
          <Row label="Tipo de ataque" value={analise.tipo_ataque} />
          <Row label="Tom emocional" value={analise.tom} />
          <Row label="Audiência provável" value={analise.audiencia} />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Urgência de resposta
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={urgenciaColor}>
                {analise.urgencia}/10
              </Badge>
              <span className="text-xs text-muted-foreground">
                {analise.urgencia >= 8
                  ? 'Responder em até 1h'
                  : analise.urgencia >= 5
                    ? 'Responder no mesmo dia'
                    : 'Pode aguardar 24h'}
              </span>
            </div>
          </div>

          {analise.dados_citados.length > 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-300">
                <ShieldAlert className="h-3.5 w-3.5" /> Dados citados — verificar fato:
              </p>
              <ul className="space-y-0.5 text-xs text-foreground/90">
                {analise.dados_citados.map((d, i) => (
                  <li key={i}>• {d}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-vortex-border bg-vortex-bg/50 p-3 text-xs text-muted-foreground">
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              Nenhum dado factual citado — ataque parece opinativo.
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onAnalyze} disabled={analyzing}>
          <RefreshCw className={analyzing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          {analise ? 'Reanalisar' : 'Analisar'}
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Pular verificação
        </Button>
        <Button onClick={onNext} disabled={!analise} className="ml-auto">
          Verificar fatos
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm ${highlight ? 'font-semibold text-foreground' : 'text-foreground/90'}`}>
        {value}
      </p>
    </div>
  );
}
