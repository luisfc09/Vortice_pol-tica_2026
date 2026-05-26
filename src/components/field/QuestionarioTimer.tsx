import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  startedAt: number; // performance.now() do início
  /**
   * Chamado quando o tempo passa do limite recomendado.
   * Útil pra disparar vibração no celular.
   */
  onWarn?: (level: 'yellow' | 'red') => void;
}

const YELLOW_AT_S = 6 * 60;
const RED_AT_S = 8 * 60;

function format(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Timer crescente fixado no canto superior direito. Vira amarelo aos
 * 6min e vermelho aos 8min com vibração. Institutos eleitorais
 * recomendam não passar de 8min — daí o sinal visual.
 */
export function QuestionarioTimer({ startedAt, onWarn }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [warned, setWarned] = useState<{ yellow: boolean; red: boolean }>({
    yellow: false,
    red: false,
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(Math.floor((performance.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (elapsed >= RED_AT_S && !warned.red) {
      setWarned((w) => ({ ...w, red: true }));
      onWarn?.('red');
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          (navigator as Navigator & { vibrate: (p: number[]) => boolean })
            .vibrate([200, 100, 200]);
        } catch {
          // navegadores que não suportam vibrate
        }
      }
    } else if (elapsed >= YELLOW_AT_S && !warned.yellow) {
      setWarned((w) => ({ ...w, yellow: true }));
      onWarn?.('yellow');
    }
  }, [elapsed, warned, onWarn]);

  const tone =
    elapsed >= RED_AT_S
      ? 'border-red-500/60 bg-red-500/15 text-red-200'
      : elapsed >= YELLOW_AT_S
        ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
        : 'border-vortex-border bg-vortex-surface/80 text-foreground';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm transition-colors',
        tone,
      )}
      title="Institutos recomendam máximo 8 minutos por entrevista"
    >
      <Clock className="h-3.5 w-3.5" />
      {format(elapsed)}
    </div>
  );
}
