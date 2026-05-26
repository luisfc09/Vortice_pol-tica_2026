// Centroides aproximados dos municípios principais de MG, para uso no mapa.
// Coordenadas em (lat, lng). Em produção o ideal é carregar o GeoJSON oficial
// do IBGE e calcular centróides.

export const MUNI_COORDS: Record<string, { name: string; lat: number; lng: number }> = {
  '3106200': { name: 'Belo Horizonte', lat: -19.9167, lng: -43.9345 },
  '3118601': { name: 'Contagem', lat: -19.9317, lng: -44.0539 },
  '3122306': { name: 'Divinópolis', lat: -20.1389, lng: -44.8825 },
  '3127701': { name: 'Governador Valadares', lat: -18.8511, lng: -41.9489 },
  '3131307': { name: 'Ipatinga', lat: -19.4683, lng: -42.5483 },
  '3136702': { name: 'Juiz de Fora', lat: -21.7642, lng: -43.3496 },
  '3143302': { name: 'Montes Claros', lat: -16.7286, lng: -43.8582 },
  '3147907': { name: 'Pouso Alegre', lat: -22.2261, lng: -45.9342 },
  '3154606': { name: 'Sete Lagoas', lat: -19.4658, lng: -44.2469 },
  '3156700': { name: 'Teófilo Otoni', lat: -17.8589, lng: -41.5083 },
  '3157807': { name: 'Uberaba', lat: -19.7483, lng: -47.9319 },
  '3170206': { name: 'Uberlândia', lat: -18.9186, lng: -48.2772 },
  '3171303': { name: 'Varginha', lat: -21.5556, lng: -45.4306 },
  '3105608': { name: 'Barbacena', lat: -21.2256, lng: -43.7742 },
  '3108107': { name: 'Betim', lat: -19.9678, lng: -44.1981 },
  '3129806': { name: 'Itabira', lat: -19.6228, lng: -43.2267 },
  '3129707': { name: 'Itajubá', lat: -22.4253, lng: -45.4528 },
  '3136306': { name: 'João Monlevade', lat: -19.8101, lng: -43.1731 },
  '3137601': { name: 'Lavras', lat: -21.245, lng: -45.0 },
  '3144805': { name: 'Muriaé', lat: -21.13, lng: -42.366 },
  '3145901': { name: 'Nova Lima', lat: -19.9858, lng: -43.8472 },
  '3148004': { name: 'Passos', lat: -20.7194, lng: -46.6094 },
  '3148905': { name: 'Patos de Minas', lat: -18.5789, lng: -46.5181 },
  '3150208': { name: 'Pirapora', lat: -17.345, lng: -44.9425 },
  '3151404': { name: 'Poços de Caldas', lat: -21.7878, lng: -46.5614 },
  '3153905': { name: 'Sabará', lat: -19.8861, lng: -43.8064 },
  '3155306': { name: 'São João del Rei', lat: -21.135, lng: -44.2614 },
  '3162500': { name: 'Santa Luzia', lat: -19.7697, lng: -43.8517 },
  '3170107': { name: 'Ubá', lat: -21.1192, lng: -42.9425 },
  '3172202': { name: 'Vespasiano', lat: -19.6919, lng: -43.9233 },
  '3106705': { name: 'Bocaiúva', lat: -17.1108, lng: -43.8158 },
  '3134202': { name: 'Janaúba', lat: -15.8025, lng: -43.3094 },
  '3134400': { name: 'Januária', lat: -15.4853, lng: -44.3625 },
  '3138401': { name: 'Lagoa Santa', lat: -19.6275, lng: -43.8919 },
  '3143906': { name: 'Muzambinho', lat: -21.3686, lng: -46.5236 },
  '3149309': { name: 'Pedro Leopoldo', lat: -19.6181, lng: -44.0431 },
};

export interface MuniStat {
  code: string;
  name: string;
  lat: number;
  lng: number;
  supporters: number;
  voters: number;
  apoiadores: number;
  population: number; // estimativa para o cálculo de força política
  strength: number; // 0..1
}

// População aproximada — apenas para o cálculo relativo de força.
const POP: Record<string, number> = {
  '3106200': 2_400_000,
  '3118601': 670_000,
  '3122306': 240_000,
  '3127701': 280_000,
  '3131307': 260_000,
  '3136702': 580_000,
  '3143302': 420_000,
  '3147907': 150_000,
  '3154606': 240_000,
  '3156700': 140_000,
  '3157807': 340_000,
  '3170206': 720_000,
  '3171303': 140_000,
  '3105608': 140_000,
  '3108107': 440_000,
  '3129806': 120_000,
  '3129707': 95_000,
  '3136306': 80_000,
  '3137601': 110_000,
  '3144805': 110_000,
  '3145901': 95_000,
  '3148004': 110_000,
  '3148905': 160_000,
  '3150208': 60_000,
  '3151404': 170_000,
  '3153905': 135_000,
  '3155306': 90_000,
  '3162500': 220_000,
  '3170107': 110_000,
  '3172202': 130_000,
  '3106705': 50_000,
  '3134202': 75_000,
  '3134400': 65_000,
  '3138401': 60_000,
  '3143906': 22_000,
  '3149309': 65_000,
};

export function populationOf(code: string): number {
  return POP[code] ?? 50_000;
}
