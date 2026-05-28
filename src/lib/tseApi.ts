// Cliente HTTP do backend Express (proxy/cache dos dados do TSE).
//
// O backend roda local em http://localhost:3001 e, em produção, na URL
// definida em VITE_BACKEND_URL (ex.: o serviço do backend no Railway).
// Se a env não estiver setada, cai no localhost — útil em dev.

const BASE_URL = (
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:3001'
).replace(/\/$/, '');

export const TSE_BASE_URL = BASE_URL;

// ----------------------------------------------------------------------------
// Tipos das respostas
// ----------------------------------------------------------------------------

export interface TseCombinacao {
  ano: number;
  turno: number;
  uf: string;
  cargo_codigo: string;
  cargo_label: string;
  linhas: number;
  municipios: number;
}

export interface TseLider {
  sequencial: string;
  nome: string;
  nome_urna: string | null;
  numero: string;
  partido: string | null;
  partido_numero: string | null;
  votos: number;
  situacao: string | null;
}

export interface TseMapaMunicipio {
  municipio_codigo: string;
  municipio_nome: string;
  total_votos: number;
  n_candidatos: number;
  lider: TseLider;
}

export interface TseMapaResposta {
  ano: number;
  cargo: string;
  cargo_label: string;
  turno: number;
  uf: string;
  total_municipios: number;
  municipios: TseMapaMunicipio[];
}

export interface TseCandidato {
  candidato: string;
  nome_urna: string | null;
  numero: string;
  sequencial: string;
  partido: string | null;
  partido_numero: string | null;
  situacao: string | null;
  cargo_codigo?: string;
  votos: number;
  municipios: number;
}

export interface TseMunicipioRankingItem {
  posicao: number;
  candidato: string;
  nome_urna: string | null;
  numero: string;
  sequencial: string;
  partido: string | null;
  partido_numero: string | null;
  coligacao: string | null;
  situacao: string | null;
  votos: number;
}

export interface TseMunicipioRanking {
  municipio: string;
  municipio_codigo: string;
  ano: string;
  uf: string;
  turno: number;
  cargo: string;
  cargo_codigo: string;
  total_votos: number;
  candidatos: TseMunicipioRankingItem[];
  empty?: boolean;
}

// ----------------------------------------------------------------------------
// Fetch helper — timeout + erro amigável
// ----------------------------------------------------------------------------

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  // Encadeia o abort externo (se houver) no controller interno
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body?.detalhe || body?.error || detail;
      } catch {
        /* corpo não-JSON */
      }
      throw new Error(detail);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ----------------------------------------------------------------------------
// Endpoints
// ----------------------------------------------------------------------------

export const tseApi = {
  // Combinações (ano, turno, uf, cargo) presentes na base.
  async combinacoes(signal?: AbortSignal): Promise<TseCombinacao[]> {
    const r = await getJson<{ data: TseCombinacao[] }>('/api/tse/anos', signal);
    return r.data ?? [];
  },

  // Resumo por município (líder + totais) pra colorir o mapa.
  async mapa(
    params: { ano: number; cargo: string; turno: number; uf?: string },
    signal?: AbortSignal,
  ): Promise<TseMapaResposta> {
    return getJson<TseMapaResposta>(
      `/api/tse/mapa${qs({ ...params, uf: params.uf ?? 'MG' })}`,
      signal,
    );
  },

  // Ranking estadual agregado de candidatos.
  async candidatos(
    params: {
      ano: number;
      cargo: string;
      turno: number;
      uf?: string;
      nome?: string;
      partido?: string;
      limit?: number;
    },
    signal?: AbortSignal,
  ): Promise<TseCandidato[]> {
    const r = await getJson<{ data: TseCandidato[] }>(
      `/api/tse/candidatos${qs({ ...params, uf: params.uf ?? 'MG' })}`,
      signal,
    );
    return r.data ?? [];
  },

  // Ranking de um município (path param aceita código TSE ou nome).
  async municipio(
    municipio: string,
    params: { ano: number; cargo: string; turno: number; uf?: string },
    signal?: AbortSignal,
  ): Promise<TseMunicipioRanking> {
    return getJson<TseMunicipioRanking>(
      `/api/tse/municipios/${encodeURIComponent(municipio)}${qs({
        ...params,
        uf: params.uf ?? 'MG',
      })}`,
      signal,
    );
  },
};
