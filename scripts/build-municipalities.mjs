// scripts/build-municipalities.mjs
//
// Lê public/data/mg-municipios.geojson (853 municípios IBGE) e gera:
//   - src/data/municipalities-mg.ts        → MG_MUNICIPALITIES (code, name)
//   - src/data/municipalities-mg-coords.ts → MUNI_COORDS, populationOf, MuniStat
//
// Centróides são calculados pelo método "média dos vértices do anel externo".
// Para os polígonos do IBGE isso fica visualmente correto e é estável.
//
// Para `populationOf`, mantemos uma tabela base com as principais cidades + um
// default conservador (30k) para as demais. Não bundlamos a tabela completa de
// população do IBGE — quem precisar de número real consulta a API do IBGE.
//
// Uso:
//   node scripts/build-municipalities.mjs
//
// Idempotente. Roda offline, sem rede.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GEOJSON_PATH = path.join(ROOT, 'public', 'data', 'mg-municipios.geojson');
const OUT_NAMES = path.join(ROOT, 'src', 'data', 'municipalities-mg.ts');
const OUT_COORDS = path.join(ROOT, 'src', 'data', 'municipalities-mg-coords.ts');

// População conhecida (estimativas IBGE / Censo 2022 arredondadas) — apenas
// para o cálculo relativo de força política. Demais municípios usam DEFAULT_POP.
const POPULATION = {
  '3106200': 2_315_560, // Belo Horizonte
  '3118601': 668_949,   // Contagem
  '3170206': 713_224,   // Uberlândia
  '3136702': 540_756,   // Juiz de Fora
  '3108107': 444_690,   // Betim
  '3143302': 414_240,   // Montes Claros
  '3171303': 137_017,   // Varginha
  '3157807': 333_783,   // Uberaba
  '3131307': 240_200,   // Ipatinga
  '3127701': 257_989,   // Governador Valadares
  '3154606': 245_756,   // Sete Lagoas
  '3122306': 240_408,   // Divinópolis
  '3162500': 226_186,   // Santa Luzia
  '3148905': 152_488,   // Patos de Minas
  '3147907': 152_549,   // Pouso Alegre
  '3151404': 168_452,   // Poços de Caldas
  '3105608': 140_417,   // Barbacena
  '3144805': 109_392,   // Muriaé
  '3137601': 108_117,   // Lavras
  '3148004': 113_338,   // Passos
  '3156700': 142_281,   // Teófilo Otoni
  '3129806': 117_403,   // Itabira
  '3129707': 95_945,    // Itajubá
  '3145901': 96_069,    // Nova Lima
  '3170107': 110_010,   // Ubá
  '3153905': 134_958,   // Sabará
  '3172202': 130_180,   // Vespasiano
  '3155306': 90_267,    // São João del Rei
  '3136306': 81_006,    // João Monlevade
  '3150208': 56_392,    // Pirapora
  '3138401': 60_241,    // Lagoa Santa
  '3149309': 64_811,    // Pedro Leopoldo
  '3134202': 75_407,    // Janaúba
  '3134400': 68_137,    // Januária
  '3106705': 47_618,    // Bocaiúva
  '3143906': 21_245,    // Muzambinho
};
const DEFAULT_POP = 30_000;

function centroidOf(geometry) {
  // Aproximação "average of outer ring vertices" — boa o suficiente para placar/centro.
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  const rings = [];
  if (geometry.type === 'Polygon') {
    rings.push(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    // pega o anel externo do maior polígono (por nº de vértices, proxy razoável de área)
    let biggest = geometry.coordinates[0];
    for (const poly of geometry.coordinates) {
      if (poly[0].length > biggest[0].length) biggest = poly;
    }
    rings.push(biggest[0]);
  } else {
    throw new Error(`Geometria não suportada: ${geometry.type}`);
  }
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      sumLng += lng;
      sumLat += lat;
      count += 1;
    }
  }
  return {
    lng: Number((sumLng / count).toFixed(5)),
    lat: Number((sumLat / count).toFixed(5)),
  };
}

function readGeoJson() {
  const raw = fs.readFileSync(GEOJSON_PATH, 'utf8');
  const json = JSON.parse(raw);
  if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
    throw new Error('GeoJSON inválido');
  }
  return json;
}

function buildRows() {
  const geo = readGeoJson();
  const rows = geo.features.map((f) => {
    const code = String(f.properties.id ?? f.properties.codigo_ibge ?? '');
    const name = String(f.properties.name ?? f.properties.nome ?? '');
    if (!/^31\d{5}$/.test(code)) throw new Error(`Código IBGE inválido: ${code}`);
    if (!name) throw new Error(`Nome ausente para ${code}`);
    const { lat, lng } = centroidOf(f.geometry);
    return { code, name, lat, lng };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return rows;
}

function writeNamesFile(rows) {
  const items = rows
    .map((r) => `  { code: '${r.code}', name: ${JSON.stringify(r.name)} },`)
    .join('\n');
  const out = `// Lista completa dos 853 municípios de Minas Gerais (IBGE).
// Gerado automaticamente por scripts/build-municipalities.mjs — não editar à mão.

export interface MunicipalityOption {
  code: string;
  name: string;
}

export const MG_MUNICIPALITIES: MunicipalityOption[] = [
${items}
];
`;
  fs.writeFileSync(OUT_NAMES, out);
}

function writeCoordsFile(rows) {
  const muni = rows
    .map(
      (r) =>
        `  '${r.code}': { name: ${JSON.stringify(r.name)}, lat: ${r.lat}, lng: ${r.lng} },`,
    )
    .join('\n');
  const popEntries = Object.entries(POPULATION)
    .map(([code, pop]) => `  '${code}': ${pop.toLocaleString('en-US').replace(/,/g, '_')},`)
    .join('\n');

  const out = `// Centróides dos 853 municípios de MG (IBGE). Gerado automaticamente por
// scripts/build-municipalities.mjs — não editar à mão.
//
// As coordenadas são calculadas pela média dos vértices do anel externo do
// polígono IBGE — precisão suficiente para placar/centro/tooltip do mapa.
// Para precisão geográfica (área etc.), use o GeoJSON em public/data.

export const MUNI_COORDS: Record<string, { name: string; lat: number; lng: number }> = {
${muni}
};

export interface MuniStat {
  code: string;
  name: string;
  lat: number;
  lng: number;
  supporters: number;
  voters: number;
  apoiadores: number;
  population: number; // estimativa para o cálculo relativo de força
  strength: number; // 0..1
}

// População aproximada das principais cidades (apenas para o cálculo relativo
// de força). Demais municípios usam DEFAULT_POPULATION.
const POPULATION: Record<string, number> = {
${popEntries}
};

const DEFAULT_POPULATION = ${DEFAULT_POP.toLocaleString('en-US').replace(/,/g, '_')};

export function populationOf(code: string): number {
  return POPULATION[code] ?? DEFAULT_POPULATION;
}
`;
  fs.writeFileSync(OUT_COORDS, out);
}

function main() {
  if (!fs.existsSync(GEOJSON_PATH)) {
    console.error(`GeoJSON não encontrado em ${GEOJSON_PATH}`);
    process.exit(1);
  }
  const rows = buildRows();
  writeNamesFile(rows);
  writeCoordsFile(rows);
  console.log(`OK — gerados ${rows.length} municípios:`);
  console.log(`  - ${path.relative(ROOT, OUT_NAMES)}`);
  console.log(`  - ${path.relative(ROOT, OUT_COORDS)}`);
}

main();
