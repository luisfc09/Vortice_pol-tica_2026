// Subset principal de municípios de MG para uso no formulário de campo (offline-ready).
// A lista completa do IBGE (853 municípios) será carregada do banco em produção.
// Aqui mantemos apenas os maiores + capitais regionais para o seed inicial.

export interface MunicipalityOption {
  code: string;
  name: string;
}

export const MG_MUNICIPALITIES: MunicipalityOption[] = [
  { code: '3106200', name: 'Belo Horizonte' },
  { code: '3118601', name: 'Contagem' },
  { code: '3122306', name: 'Divinópolis' },
  { code: '3127701', name: 'Governador Valadares' },
  { code: '3131307', name: 'Ipatinga' },
  { code: '3136702', name: 'Juiz de Fora' },
  { code: '3143302', name: 'Montes Claros' },
  { code: '3147907', name: 'Pouso Alegre' },
  { code: '3154606', name: 'Sete Lagoas' },
  { code: '3156700', name: 'Teófilo Otoni' },
  { code: '3157807', name: 'Uberaba' },
  { code: '3170206', name: 'Uberlândia' },
  { code: '3171303', name: 'Varginha' },
  { code: '3105608', name: 'Barbacena' },
  { code: '3108107', name: 'Betim' },
  { code: '3129806', name: 'Itabira' },
  { code: '3129707', name: 'Itajubá' },
  { code: '3136306', name: 'João Monlevade' },
  { code: '3137601', name: 'Lavras' },
  { code: '3144805', name: 'Muriaé' },
  { code: '3145901', name: 'Nova Lima' },
  { code: '3148004', name: 'Passos' },
  { code: '3148905', name: 'Patos de Minas' },
  { code: '3150208', name: 'Pirapora' },
  { code: '3151404', name: 'Poços de Caldas' },
  { code: '3153905', name: 'Sabará' },
  { code: '3155306', name: 'São João del Rei' },
  { code: '3162500', name: 'Santa Luzia' },
  { code: '3170107', name: 'Ubá' },
  { code: '3172202', name: 'Vespasiano' },
  { code: '3106705', name: 'Bocaiúva' },
  { code: '3134202', name: 'Janaúba' },
  { code: '3134400', name: 'Januária' },
  { code: '3138401', name: 'Lagoa Santa' },
  { code: '3143906', name: 'Muzambinho' },
  { code: '3149309', name: 'Pedro Leopoldo' },
];
