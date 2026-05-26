import { useEffect } from 'react';
import {
  PenSquare,
  RefreshCw,
  Check,
  ArrowLeft,
  Copy,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { RespostaGerada, RespostaRisco } from '@/types';

interface Props {
  respostas: RespostaGerada[] | null;
  generating: boolean;
  onGenerate: () => Promise<void>;
  onSelect: (idx: number) => void;
  onBack: () => void;
}

const RISCO_VARIANT: Record<RespostaRisco, 'success' | 'warning' | 'destructive'> = {
  baixo: 'success',
  medio: 'warning',
  alto: 'destructive',
};

const RISCO_LABEL: Record<RespostaRisco, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
};

export function StepRespostas({
  respostas,
  generating,
  onGenerate,
  onSelect,
  onBack,
}: Props) {
  useEffect(() => {
    if (!respostas && !generating) {
      void onGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Resposta copiada.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <PenSquare className="h-4 w-4 text-primary" />
            <span className="text-xs uppercase tracking-widest text-primary">
              Passo 4 — Respostas geradas
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Escolha o estilo que melhor combina com o momento da campanha.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={generating}>
          <RefreshCw className={generating ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Regerar todas
        </Button>
      </header>

      {generating && (!respostas || respostas.length === 0) ? (
        <div className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-6 text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-foreground">Gerando 3 opções de resposta...</p>
          <p className="text-xs text-muted-foreground">
            Variando entre tom direto, humanizado e propositivo.
          </p>
        </div>
      ) : null}

      {respostas && respostas.length > 0 ? (
        <div className="space-y-3">
          {respostas.map((r, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
                    {idx + 1}
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {r.estilo}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      — {r.titulo}
                    </span>
                  </p>
                </div>
                <Badge variant={RISCO_VARIANT[r.risco]}>
                  Risco: {RISCO_LABEL[r.risco]}
                </Badge>
              </div>

              <p className="rounded-lg bg-vortex-bg/50 p-3 text-sm text-foreground/90">
                {r.texto}
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {r.caracteres} caracteres · {r.adequada_para}
                </span>
                <span className="text-foreground/70">{r.justificativa}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => copy(r.texto)}>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <Button size="sm" onClick={() => onSelect(idx)}>
                  <Check className="h-3.5 w-3.5" /> Usar esta
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar ao contexto
        </Button>
      </div>
    </div>
  );
}
