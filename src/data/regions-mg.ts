// Mapeamento de municípios de MG a macrorregiões eleitorais.
// As 12 macrorregiões oficiais do IBGE são consolidadas em 6 regiões para o
// Dashboard. Em produção, este mapeamento deveria vir da tabela municipalities.

export type MgRegion =
  | 'Norte'
  | 'Triângulo'
  | 'Central'
  | 'Zona da Mata'
  | 'Sul'
  | 'Oeste';

export const MG_REGIONS: MgRegion[] = [
  'Norte',
  'Triângulo',
  'Central',
  'Zona da Mata',
  'Sul',
  'Oeste',
];

// Subset principal — ibge_code → região. Para os 36 municípios que temos
// catalogados em municipalities-mg.ts.
export const MUNI_TO_REGION: Record<string, MgRegion> = {
  // Central / RMBH
  '3106200': 'Central', // Belo Horizonte
  '3118601': 'Central', // Contagem
  '3108107': 'Central', // Betim
  '3145901': 'Central', // Nova Lima
  '3153905': 'Central', // Sabará
  '3162500': 'Central', // Santa Luzia
  '3172202': 'Central', // Vespasiano
  '3138401': 'Central', // Lagoa Santa
  '3149309': 'Central', // Pedro Leopoldo
  '3154606': 'Central', // Sete Lagoas
  '3129806': 'Central', // Itabira
  '3136306': 'Central', // João Monlevade
  '3131307': 'Central', // Ipatinga (Vale do Aço — agrupada em Central)

  // Norte
  '3143302': 'Norte', // Montes Claros
  '3134202': 'Norte', // Janaúba
  '3134400': 'Norte', // Januária
  '3150208': 'Norte', // Pirapora
  '3106705': 'Norte', // Bocaiúva
  '3127701': 'Norte', // Governador Valadares (Leste; agrupada em Norte)
  '3156700': 'Norte', // Teófilo Otoni (Mucuri; agrupada em Norte)

  // Triângulo / Alto Paranaíba
  '3170206': 'Triângulo', // Uberlândia
  '3157807': 'Triângulo', // Uberaba
  '3148905': 'Triângulo', // Patos de Minas

  // Zona da Mata
  '3136702': 'Zona da Mata', // Juiz de Fora
  '3170107': 'Zona da Mata', // Ubá
  '3144805': 'Zona da Mata', // Muriaé
  '3105608': 'Zona da Mata', // Barbacena (Campo das Vertentes; agrupada em ZM)
  '3155306': 'Zona da Mata', // São João del Rei

  // Sul de Minas
  '3147907': 'Sul', // Pouso Alegre
  '3151404': 'Sul', // Poços de Caldas
  '3171303': 'Sul', // Varginha
  '3129707': 'Sul', // Itajubá
  '3148004': 'Sul', // Passos
  '3137601': 'Sul', // Lavras
  '3143906': 'Sul', // Muzambinho

  // Oeste / Centro-Oeste
  '3122306': 'Oeste', // Divinópolis
};

export function regionOf(ibgeCode: string | null | undefined): MgRegion | null {
  if (!ibgeCode) return null;
  return MUNI_TO_REGION[ibgeCode] ?? null;
}
