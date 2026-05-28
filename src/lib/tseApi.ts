// Acesso aos dados eleitorais do TSE.
//
// Em produção o frontend fala DIRETO com o Supabase (RPCs liberadas pra anon
// + tabela tse_resultados com SELECT público). Não depende do backend Express
// — ele continua existindo só pra dev local e pro importer CLI.
//
// A interface pública (tseApi.combinacoes/mapa/candidatos/municipio) é a mesma
// que os componentes consomem; só a implementação mudou (fetch → supabase-js).

import { supabase, USE_MOCKS } from '@/lib/supabase';

// Labels de cargo (o RPC tse_combinacoes não traz o rótulo, só o código).
export const CARGO_LABELS: Record<string, string> = {
  '1': 'Presidente',
  '3': 'Governador',
  '5': 'Senador',
  '6': 'Deputado Federal',
  '7': 'Deputado Estadual',
  '8': 'Deputado Distrital',
  '11': 'Prefeito',
  '13': 'Vereador',
};

// ----------------------------------------------------------------------------
// Tipos das respostas (shape consumido pelos componentes)
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
// Tipos crus das RPCs (snake_case do Postgres)
// ----------------------------------------------------------------------------

interface RawCombinacao {
  ano: number;
  turno: number;
  uf: string;
  cargo_codigo: string;
  linhas: number;
  municipios: number;
}

interface RawMapaRow {
  municipio_codigo: string;
  municipio_nome: string;
  total_votos: number;
  n_candidatos: number;
  lider_sequencial: string;
  lider_nome: string;
  lider_urna: string | null;
  lider_numero: string;
  lider_partido: string | null;
  lider_partido_numero: string | null;
  lider_votos: number;
  lider_situacao: string | null;
}

interface RawCandidato {
  sequencial_candidato: string;
  nome_candidato: string;
  nome_urna: string | null;
  numero_candidato: string;
  partido_sigla: string | null;
  partido_numero: string | null;
  situacao: string | null;
  cargo_codigo: string;
  votos: number;
  municipios: number;
}

interface RawMunicipioRow {
  municipio_codigo: string;
  municipio_nome: string;
  nome_candidato: string;
  nome_urna: string | null;
  numero_candidato: string;
  sequencial_candidato: string;
  partido_sigla: string | null;
  partido_numero: string | null;
  coligacao: string | null;
  situacao: string | null;
  votos: number;
  cargo_codigo: string;
  cargo_label: string | null;
  turno: number;
}

function ensureLive() {
  if (USE_MOCKS) {
    throw new Error(
      'Dados do TSE indisponíveis em modo demonstração. Conecte ao Supabase (VITE_USE_MOCKS=false).',
    );
  }
}

// ----------------------------------------------------------------------------
// API
// ----------------------------------------------------------------------------

export const tseApi = {
  // Combinações (ano, turno, uf, cargo) presentes na base.
  async combinacoes(signal?: AbortSignal): Promise<TseCombinacao[]> {
    ensureLive();
    let q = supabase.rpc('tse_combinacoes');
    if (signal) q = q.abortSignal(signal);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as RawCombinacao[]).map((r) => ({
      ano: r.ano,
      turno: r.turno,
      uf: r.uf,
      cargo_codigo: r.cargo_codigo,
      cargo_label: CARGO_LABELS[r.cargo_codigo] ?? r.cargo_codigo,
      linhas: Number(r.linhas ?? 0),
      municipios: Number(r.municipios ?? 0),
    }));
  },

  // Resumo por município (líder + totais) pra colorir o mapa.
  async mapa(
    params: { ano: number; cargo: string; turno: number; uf?: string },
    signal?: AbortSignal,
  ): Promise<TseMapaResposta> {
    ensureLive();
    const uf = (params.uf ?? 'MG').toUpperCase();
    let q = supabase.rpc('tse_mapa_resumo', {
      p_ano: params.ano,
      p_cargo: params.cargo,
      p_turno: params.turno,
      p_uf: uf,
    });
    if (signal) q = q.abortSignal(signal);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const municipios: TseMapaMunicipio[] = ((data ?? []) as RawMapaRow[]).map((r) => ({
      municipio_codigo: r.municipio_codigo,
      municipio_nome: r.municipio_nome,
      total_votos: Number(r.total_votos ?? 0),
      n_candidatos: Number(r.n_candidatos ?? 0),
      lider: {
        sequencial: r.lider_sequencial,
        nome: r.lider_nome,
        nome_urna: r.lider_urna,
        numero: r.lider_numero,
        partido: r.lider_partido,
        partido_numero: r.lider_partido_numero,
        votos: Number(r.lider_votos ?? 0),
        situacao: r.lider_situacao,
      },
    }));
    return {
      ano: params.ano,
      cargo: params.cargo,
      cargo_label: CARGO_LABELS[params.cargo] ?? params.cargo,
      turno: params.turno,
      uf,
      total_municipios: municipios.length,
      municipios,
    };
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
    ensureLive();
    let q = supabase.rpc('tse_candidatos_agregados', {
      p_ano: params.ano,
      p_uf: (params.uf ?? 'MG').toUpperCase(),
      p_cargo: params.cargo,
      p_turno: params.turno,
      p_nome: params.nome ?? null,
      p_numero: null,
      p_partido: params.partido ? params.partido.toUpperCase() : null,
      p_limit: params.limit ?? 500,
    });
    if (signal) q = q.abortSignal(signal);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as RawCandidato[]).map((r) => ({
      candidato: r.nome_candidato,
      nome_urna: r.nome_urna,
      numero: r.numero_candidato,
      sequencial: r.sequencial_candidato,
      partido: r.partido_sigla,
      partido_numero: r.partido_numero,
      situacao: r.situacao,
      cargo_codigo: r.cargo_codigo,
      votos: Number(r.votos ?? 0),
      municipios: Number(r.municipios ?? 0),
    }));
  },

  // Ranking de um município (path param = código TSE ou nome).
  async municipio(
    municipio: string,
    params: { ano: number; cargo: string; turno: number; uf?: string },
    signal?: AbortSignal,
  ): Promise<TseMunicipioRanking> {
    ensureLive();
    const uf = (params.uf ?? 'MG').toUpperCase();
    let q = supabase
      .from('tse_resultados')
      .select(
        'municipio_codigo, municipio_nome, nome_candidato, nome_urna, numero_candidato, sequencial_candidato, partido_sigla, partido_numero, coligacao, situacao, votos, cargo_codigo, cargo_label, turno',
      )
      .eq('ano', params.ano)
      .eq('uf', uf)
      .eq('cargo_codigo', params.cargo)
      .eq('turno', params.turno)
      .order('votos', { ascending: false })
      .limit(2000);

    if (/^\d+$/.test(municipio)) q = q.eq('municipio_codigo', municipio);
    else q = q.ilike('municipio_nome', municipio);

    if (signal) q = q.abortSignal(signal);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as RawMunicipioRow[];
    if (rows.length === 0) {
      return {
        municipio: municipio.toUpperCase(),
        municipio_codigo: /^\d+$/.test(municipio) ? municipio : '',
        ano: String(params.ano),
        uf,
        turno: params.turno,
        cargo: CARGO_LABELS[params.cargo] ?? params.cargo,
        cargo_codigo: params.cargo,
        total_votos: 0,
        candidatos: [],
        empty: true,
      };
    }

    const candidatos: TseMunicipioRankingItem[] = rows.map((r, i) => ({
      posicao: i + 1,
      candidato: r.nome_candidato,
      nome_urna: r.nome_urna,
      numero: r.numero_candidato,
      sequencial: r.sequencial_candidato,
      partido: r.partido_sigla,
      partido_numero: r.partido_numero,
      coligacao: r.coligacao,
      situacao: r.situacao,
      votos: Number(r.votos ?? 0),
    }));
    const first = rows[0];
    return {
      municipio: first.municipio_nome,
      municipio_codigo: first.municipio_codigo,
      ano: String(params.ano),
      uf,
      turno: params.turno,
      cargo: first.cargo_label ?? CARGO_LABELS[params.cargo] ?? params.cargo,
      cargo_codigo: params.cargo,
      total_votos: candidatos.reduce((s, c) => s + c.votos, 0),
      candidatos,
    };
  },
};
