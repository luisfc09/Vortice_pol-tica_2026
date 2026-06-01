// SemaforoIndicator — bolinha colorida (verde/amarelo/vermelho) usada
// na tabela por cidade e no widget do Dashboard. Compartilhado pra
// manter a mesma paleta em todos os lugares.

import { cn } from '@/lib/utils';
import type { SemaforoColor } from '@/types';

const COLOR_CLASS: Record<SemaforoColor, string> = {
  verde: 'bg-emerald-500 text-emerald-950 border-emerald-400',
  amarelo: 'bg-amber-400 text-amber-950 border-amber-300',
  vermelho: 'bg-red-500 text-red-50 border-red-400',
  indeterminado: 'bg-muted text-muted-foreground border-border',
};

const LABEL: Record<SemaforoColor, string> = {
  verde: 'Verde',
  amarelo: 'Amarelo',
  vermelho: 'Vermelho',
  indeterminado: 'Sem dados',
};

interface Props {
  color: SemaforoColor;
  /** Mostra o texto ao lado da bolinha. Default = só bolinha. */
  showLabel?: boolean;
  /** Tamanho da bolinha em px. Default 12. */
  size?: number;
  className?: string;
}

export function SemaforoIndicator({
  color,
  showLabel = false,
  size = 12,
  className,
}: Props) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-label={LABEL[color]}
        title={LABEL[color]}
        className={cn(
          'inline-block rounded-full border',
          COLOR_CLASS[color],
        )}
        style={{ width: size, height: size }}
      />
      {showLabel ? (
        <span className="text-xs font-medium text-foreground">
          {LABEL[color]}
        </span>
      ) : null}
    </span>
  );
}

export const SEMAFORO_LABEL = LABEL;
