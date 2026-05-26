import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Zap, ArrowLeft, Clock, AlertTriangle, RotateCcw, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { collections } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import { useRespostaRapida, type StepIndex } from '@/hooks/useRespostaRapida';
import { StepDeteccao } from '@/components/mencoes/StepDeteccao';
import { StepAnalise } from '@/components/mencoes/StepAnalise';
import { StepContexto } from '@/components/mencoes/StepContexto';
import { StepRespostas } from '@/components/mencoes/StepRespostas';
import { StepAprovar } from '@/components/mencoes/StepAprovar';

const STEPS: Array<{ idx: StepIndex; label: string }> = [
  { idx: 1, label: 'Menção' },
  { idx: 2, label: 'Análise' },
  { idx: 3, label: 'Contexto' },
  { idx: 4, label: 'Respostas' },
  { idx: 5, label: 'Aprovar' },
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}min ${String(s).padStart(2, '0')}s`;
}

export default function RespostaRapidaPage() {
  const session = useAuthStore((s) => s.session);
  const [params] = useSearchParams();
  const flow = useRespostaRapida();

  // Suporta entrada direta com ?mention=<id> (vindo do alerta)
  useEffect(() => {
    const id = params.get('mention');
    if (id && id !== flow.state.mentionId) {
      const m = collections.mentions.get(id);
      if (m) flow.selectMention(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  if (!session?.campaign) return null;

  const currentStep = flow.state.step;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/mencoes">
              <ArrowLeft className="h-4 w-4" /> Monitor de menções
            </Link>
          </Button>
          <div className="mb-1 flex items-center gap-2">
            <Zap className="h-4 w-4 text-vortex-lime" />
            <span className="text-xs uppercase tracking-widest text-vortex-lime">
              Resposta Rápida
            </span>
          </div>
          <h2 className="font-display text-3xl tracking-wide text-foreground">
            Stepper de crise
          </h2>
          <p className="text-sm text-muted-foreground">
            Detectar, analisar, contextualizar e responder em até 1h. IA escolhida em{' '}
            <Link to="/integracoes" className="underline">
              Integrações → IA por funcionalidade
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {flow.state.startedAtIso ? (
            <Badge variant={flow.janelaExpirada ? 'destructive' : 'outline'} className="gap-1">
              {flow.janelaExpirada ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {flow.janelaExpirada
                ? 'Janela ideal expirada'
                : formatElapsed(flow.elapsedSeconds)}
            </Badge>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link to="/mencoes/resposta-rapida/historico">
              <History className="h-4 w-4" /> Histórico
            </Link>
          </Button>
          {flow.state.mentionId ? (
            <Button variant="ghost" size="sm" onClick={() => flow.reset()}>
              <RotateCcw className="h-4 w-4" /> Reiniciar
            </Button>
          ) : null}
        </div>
      </div>

      {/* Stepper */}
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((s, i) => {
            const reached = currentStep >= s.idx;
            const active = currentStep === s.idx;
            return (
              <div key={s.idx} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Só permite voltar para um passo já habilitado (≤ atual)
                    if (s.idx <= currentStep && flow.state.mentionId) {
                      flow.goTo(s.idx);
                    } else if (s.idx === 1) {
                      flow.goTo(1);
                    }
                  }}
                  disabled={s.idx > currentStep || (!flow.state.mentionId && s.idx > 1)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg border px-2 py-1 transition-colors',
                    active && 'border-primary bg-primary/15 text-primary',
                    !active && reached && 'border-vortex-border bg-vortex-bg/60 text-foreground',
                    !active && !reached && 'border-vortex-border bg-vortex-bg/30 text-muted-foreground',
                    s.idx > currentStep && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                      active && 'bg-primary text-primary-foreground',
                      !active && reached && 'bg-primary/30 text-primary',
                      !active && !reached && 'bg-vortex-bg text-muted-foreground',
                    )}
                  >
                    {s.idx}
                  </span>
                  <span className="hidden text-xs font-medium sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 ? (
                  <div
                    className={cn(
                      'h-px flex-1 transition-colors',
                      currentStep > s.idx ? 'bg-primary/40' : 'bg-vortex-border',
                    )}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Conteúdo do passo */}
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/30 p-5 backdrop-blur">
        {currentStep === 1 ? (
          <StepDeteccao onSelect={flow.selectMention} />
        ) : null}

        {currentStep === 2 && flow.mention ? (
          <StepAnalise
            mention={flow.mention}
            analise={flow.state.analise}
            analyzing={flow.analyzing}
            onAnalyze={flow.runAnalyze}
            onSkip={flow.skipAnalyze}
            onNext={() => flow.goTo(3)}
          />
        ) : null}

        {currentStep === 3 ? (
          <StepContexto
            contexto={flow.state.contexto}
            onChange={flow.updateContext}
            onBack={() => flow.goTo(2)}
            onNext={() => flow.goTo(4)}
          />
        ) : null}

        {currentStep === 4 && flow.mention ? (
          <StepRespostas
            respostas={flow.state.respostas}
            generating={flow.generating}
            onGenerate={flow.runGenerate}
            onSelect={flow.selectResposta}
            onBack={() => flow.goTo(3)}
          />
        ) : null}

        {currentStep === 5 &&
        flow.state.respostas &&
        flow.state.selectedIndex != null ? (
          <StepAprovar
            resposta={flow.state.respostas[flow.state.selectedIndex]}
            draftText={flow.state.draftText}
            edited={flow.state.edited}
            saving={flow.saving}
            elapsedSeconds={flow.elapsedSeconds}
            onChangeDraft={flow.updateDraft}
            onCopy={flow.copyDraft}
            onBack={() => flow.goTo(4)}
            onApprove={flow.aprovar}
          />
        ) : null}

        {/* Fallback: stepper em estado inconsistente */}
        {currentStep > 1 && !flow.mention ? (
          <div className="rounded-lg border border-dashed border-vortex-border bg-vortex-bg/40 p-6 text-center text-sm text-muted-foreground">
            Sessão anterior expirada. Recomece selecionando uma menção.
            <div className="mt-3">
              <Button onClick={() => flow.reset()}>Recomeçar</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
