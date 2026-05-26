import { useEffect, useState } from 'react';

/**
 * Resposta do endpoint público https://viacep.com.br/ws/{cep}/json/
 * Documentação: https://viacep.com.br/
 */
export interface ViaCEPResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string; // município
  uf: string;
  ibge: string; // código IBGE (7 dígitos)
  erro?: boolean;
}

export interface ViaCEPState {
  loading: boolean;
  error: string | null;
  data: ViaCEPResult | null;
}

const CACHE = new Map<string, ViaCEPResult>();

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formata CEP no padrão `00000-000`. Aceita qualquer entrada e devolve
 * a string com hífen quando há 8 dígitos.
 */
export function formatCEP(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Hook que busca um endereço por CEP usando ViaCEP. Faz debounce de 350ms
 * e cacheia resultados em memória pela sessão.
 *
 * Recebe a string crua (com ou sem hífen). Quando há 8 dígitos válidos,
 * dispara o fetch. Caso contrário fica idle.
 */
export function useViaCEP(cep: string): ViaCEPState {
  const [state, setState] = useState<ViaCEPState>({
    loading: false,
    error: null,
    data: null,
  });

  useEffect(() => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) {
      setState({ loading: false, error: null, data: null });
      return;
    }
    const cached = CACHE.get(digits);
    if (cached) {
      setState({ loading: false, error: null, data: cached });
      return;
    }

    let active = true;
    const handle = setTimeout(async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ViaCEPResult;
        if (!active) return;
        if (json.erro) {
          setState({ loading: false, error: 'CEP não encontrado.', data: null });
          return;
        }
        CACHE.set(digits, json);
        setState({ loading: false, error: null, data: json });
      } catch (err) {
        if (!active) return;
        setState({
          loading: false,
          error: err instanceof Error ? err.message : 'Falha ao consultar CEP.',
          data: null,
        });
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [cep]);

  return state;
}
