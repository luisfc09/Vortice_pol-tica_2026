import { useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';

const STORAGE_KEY = 'vortice:campo:boas-praticas-dismissed';

/**
 * Card fixo no topo de /campo/entrevista lembrando o limite de tempo
 * recomendado por institutos eleitorais. Some quando o usuário clica
 * "Entendi" — persistido em localStorage por dispositivo. Não aparece
 * no questionário aprofundado (lá o timer já mostra a regra).
 */
export function BoasPraticasCard() {
  const [hidden, setHidden] = useState(true);

  // SSR-safe: começa escondido e revela depois de checar localStorage no client.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(STORAGE_KEY) === '1';
    setHidden(dismissed);
  }, []);

  function dismiss() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <div className="relative rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 backdrop-blur">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute right-2 top-2 rounded-md p-1 text-amber-200/70 transition-colors hover:bg-amber-500/10 hover:text-amber-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="mb-2 flex items-center gap-2 pr-6">
        <Clock className="h-4 w-4 text-amber-300" />
        <p className="font-semibold text-amber-100">
          Boas práticas de entrevista eleitoral
        </p>
      </div>

      <ol className="ml-1 space-y-1 text-sm text-amber-100/90">
        <li>
          <span className="font-semibold">1.</span> Máximo 8 minutos — acima
          disso o eleitor vai embora.
        </li>
        <li>
          <span className="font-semibold">2.</span> Perguntas fechadas
          primeiro — dado vira gráfico.
        </li>
        <li>
          <span className="font-semibold">3.</span> Abertas no final — captura
          o inesperado.
        </li>
      </ol>

      <button
        type="button"
        onClick={dismiss}
        className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-500/25"
      >
        Entendi — não mostrar novamente
      </button>
    </div>
  );
}
