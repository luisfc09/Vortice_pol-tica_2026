import { CalendarPlus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AgendaAction } from '@/types';

interface Props {
  actions: AgendaAction[];
  onAddToAgenda?: (action: AgendaAction) => void;
}

export function AgendaRecomendada({ actions, onAddToAgenda }: Props) {
  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 text-sm text-muted-foreground">
        A IA ainda não recomendou uma agenda. Acione a análise quando tiver
        pelo menos 50 entrevistas completas.
      </div>
    );
  }
  // Ordena por prioridade desc
  const sorted = [...actions].sort((a, b) => b.prioridade - a.prioridade);
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
      <h3 className="font-display text-lg tracking-wide text-foreground">
        Agenda recomendada pela IA
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Sugestões com base nos dados das entrevistas
      </p>
      <ol className="space-y-2">
        {sorted.map((a, idx) => (
          <li
            key={`action-${idx}`}
            className="flex flex-col gap-2 rounded-lg border border-vortex-border bg-vortex-bg/30 p-3 sm:flex-row sm:items-start"
          >
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-vortex-lime/40 bg-vortex-lime/10 text-xs font-semibold text-vortex-lime">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="font-semibold text-foreground">{a.acao}</p>
                <Badge
                  variant="outline"
                  className={
                    a.prioridade >= 5
                      ? 'border-red-500/40 text-red-200'
                      : a.prioridade >= 4
                        ? 'border-amber-500/40 text-amber-200'
                        : 'text-muted-foreground'
                  }
                >
                  prio {a.prioridade}/5
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{a.justificativa}</p>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-foreground/80">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {a.local_sugerido}
                </span>
                <span>· Público: {a.publico_alvo}</span>
              </p>
            </div>
            {onAddToAgenda ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddToAgenda(a)}
                className="shrink-0"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
