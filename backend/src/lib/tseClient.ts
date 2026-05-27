import axios, { AxiosInstance } from 'axios';

// CKAN da TSE (Dados Abertos). Documentação:
//   https://dadosabertos.tse.jus.br/
// API endpoints relevantes:
//   /api/3/action/package_list        → lista todos os datasets
//   /api/3/action/package_show?id=X   → metadados + resources de um dataset
//   /api/3/action/datastore_search    → query nos dados (filters, limit, offset)
const TSE_BASE = 'https://dadosabertos.tse.jus.br/api/3/action';

// Cliente HTTP dedicado: timeout, User-Agent identificável, e header de
// JSON. Os endpoints CKAN às vezes demoram (datastore_search pode tocar
// banco grande) — 20s evita timeouts prematuros sem deixar requests
// pendurados eternamente.
const http: AxiosInstance = axios.create({
  baseURL: TSE_BASE,
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
    'User-Agent': 'Vortice-Backend/1.0 (+https://github.com/luisfc09/Vortice_pol-tica_2026)',
  },
});

// IDs / convenção de nomes por ano. Servem como tentativa inicial; se
// não acharmos o pacote no CKAN, a fallback é package_search.
const DATASET_IDS: Record<string, Record<string, string>> = {
  '2026': {
    resultados: 'resultados-2026',
    candidatos: 'candidatos-2026',
    perfil_eleitorado: 'perfil-do-eleitorado-2026',
  },
  '2024': {
    resultados: 'resultados-2024',
    candidatos: 'candidatos-2024',
    perfil_eleitorado: 'perfil-do-eleitorado-2024',
  },
  '2022': {
    resultados: 'resultados-2022',
    candidatos: 'candidatos-2022',
    perfil_eleitorado: 'perfil-do-eleitorado-2022',
  },
  '2020': {
    resultados: 'resultados-2020',
    candidatos: 'candidatos-2020',
    perfil_eleitorado: 'perfil-do-eleitorado-2020',
  },
  '2018': {
    resultados: 'resultados-2018',
    candidatos: 'candidatos-2018',
    perfil_eleitorado: 'perfil-do-eleitorado-2018',
  },
};

// Códigos de cargo conforme dicionário TSE.
export const CARGOS: Record<string, string> = {
  '1': 'Presidente',
  '3': 'Governador',
  '5': 'Senador',
  '6': 'Deputado Federal',
  '7': 'Deputado Estadual',
  '8': 'Deputado Distrital',
  '11': 'Prefeito',
  '13': 'Vereador',
};

interface CkanResource {
  id: string;
  name: string;
  format?: string;
  datastore_active?: boolean;
}
interface CkanPackage {
  id: string;
  name: string;
  title: string;
  resources: CkanResource[];
}
interface CkanResponse<T> {
  success: boolean;
  result: T;
  error?: { message: string };
}

async function ckanGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await http.get<CkanResponse<T>>(path, { params });
  if (!res.data?.success) {
    throw new Error(`TSE CKAN error: ${res.data?.error?.message ?? 'desconhecido'}`);
  }
  return res.data.result;
}

export const tseClient = {
  // Lista nomes de TODOS os datasets do CKAN. Pesado — usar com parcimônia.
  async listarDatasets(): Promise<string[]> {
    return ckanGet<string[]>('/package_list');
  },

  // Resolve um dataset pelo id/nome do CKAN. Lança erro se não existe.
  async getPackage(datasetId: string): Promise<CkanPackage> {
    return ckanGet<CkanPackage>('/package_show', { id: datasetId });
  },

  // Devolve { nomeDoRecurso: id } só pros recursos que TÊM datastore
  // (apenas esses aceitam datastore_search com filters).
  async getResourceIds(datasetId: string): Promise<Record<string, string>> {
    const pkg = await tseClient.getPackage(datasetId);
    const ids: Record<string, string> = {};
    for (const r of pkg.resources) {
      if (r.datastore_active === false) continue;
      ids[r.name] = r.id;
    }
    return ids;
  },

  // Heurística para escolher o resource certo de "votação por município"
  // dentro de um dataset de resultados. Os nomes variam por ano
  // (votacao_secao_, votacao_municipio_zona_, etc).
  async pickResultadosResource(datasetId: string): Promise<string> {
    const resources = await tseClient.getResourceIds(datasetId);
    if (Object.keys(resources).length === 0) {
      throw new Error(`Nenhum resource com datastore ativo em ${datasetId}.`);
    }
    // Prioridade: votacao_municipio > votacao_zona > qualquer "votacao"
    const ordered = Object.entries(resources).sort((a, b) => {
      const score = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('votacao_municipio')) return 0;
        if (n.includes('votacao_zona')) return 1;
        if (n.includes('votacao')) return 2;
        if (n.includes('municipio')) return 3;
        return 9;
      };
      return score(a[0]) - score(b[0]);
    });
    const [, id] = ordered[0];
    return id;
  },

  async buscarResultados(params: {
    ano: string;
    uf?: string;
    municipio?: string;
    cargo?: string;
    candidato?: string;
    limit?: number;
    offset?: number;
  }) {
    const {
      ano,
      uf = 'MG',
      municipio,
      cargo,
      candidato,
      limit = 100,
      offset = 0,
    } = params;

    const filters: Record<string, string> = { SG_UF: uf };
    if (municipio) filters['NM_MUNICIPIO'] = municipio.toUpperCase();
    if (cargo) filters['CD_CARGO'] = cargo;
    if (candidato) filters['NM_CANDIDATO'] = candidato.toUpperCase();

    const datasetId = DATASET_IDS[ano]?.resultados ?? `resultados-${ano}`;
    const resourceId = await tseClient.pickResultadosResource(datasetId);

    const result = await ckanGet<{ records: Record<string, string>[]; total: number }>(
      '/datastore_search',
      {
        resource_id: resourceId,
        filters: JSON.stringify(filters),
        limit,
        offset,
      },
    );

    return { records: result.records, total: result.total };
  },

  async buscarCandidatos(params: {
    ano: string;
    uf?: string;
    cargo?: string;
    nome?: string;
    numero?: string;
  }) {
    const { ano, uf = 'MG', cargo, nome, numero } = params;

    const filters: Record<string, string> = { SG_UF: uf };
    if (cargo) filters['CD_CARGO'] = cargo;
    if (nome) filters['NM_CANDIDATO'] = nome.toUpperCase();
    if (numero) filters['NR_CANDIDATO'] = numero;

    const datasetId = DATASET_IDS[ano]?.candidatos ?? `candidatos-${ano}`;
    const resources = await tseClient.getResourceIds(datasetId);

    // Prefere o resource cujo nome contém "consulta_cand" (padrão TSE).
    const orderedResources = Object.entries(resources).sort((a, b) => {
      const score = (name: string) =>
        name.toLowerCase().includes('consulta_cand') ? 0 : 1;
      return score(a[0]) - score(b[0]);
    });
    const resourceId = orderedResources[0]?.[1];
    if (!resourceId) {
      throw new Error(`Nenhum resource de candidatos em ${datasetId}.`);
    }

    const result = await ckanGet<{ records: Record<string, string>[] }>(
      '/datastore_search',
      {
        resource_id: resourceId,
        filters: JSON.stringify(filters),
        limit: 50,
      },
    );
    return result.records;
  },
};
