// ============================================================================
// Vórtice — Financeiro: importador XLS (SheetJS)
// ----------------------------------------------------------------------------
// Aceita uma planilha .xlsx/.xls com uma linha por cidade. As colunas são
// reconhecidas por nome tolerante (sem acento, lowercase, com aliases) —
// veja COLUMN_ALIASES abaixo. Linhas inválidas viram 'error' / 'duplicate'
// no preview; só 'valid' e 'warning' são gravadas.
//
// Saída: ImportRowResult[] (mesmo shape do importador de CSV de eleitores)
// pra reusar o componente de preview.
// ============================================================================

import * as XLSX from 'xlsx';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';
import type { ImportRowResult } from '@/lib/csv-import';
import type { FinanceCityPlan } from '@/types';

// ----------------------------------------------------------------------------
// Aliases de colunas — tolerante a maiúsculas, acentos, sinônimos
// ----------------------------------------------------------------------------
const COLUMN_ALIASES = {
  city_name: [
    'cidade',
    'municipio',
    'município',
    'city',
    'nome cidade',
    'nome do município',
    'nome do municipio',
  ],
  polo_logistico: ['polo', 'polo logistico', 'polo logístico', 'regional'],
  meta_votos_2022: [
    'votos 2022',
    'meta 2022',
    'votos2022',
    'historico 2022',
    'histórico 2022',
  ],
  meta_votos_2026: [
    'meta 2026',
    'votos 2026',
    'meta de votos',
    'meta votos',
    'meta',
  ],
  coord_name: [
    'coordenador',
    'coord',
    'coord nome',
    'nome coordenador',
    'nome do coordenador',
  ],
  coord_value: [
    'custo coordenador',
    'valor coordenador',
    'coord valor',
    'coord custo',
    'salario coordenador',
    'salário coordenador',
  ],
  cabos_qty: [
    'cabos',
    'cabos eleitorais',
    'qtd cabos',
    'quantidade cabos',
    'numero cabos',
    'número cabos',
  ],
  cabo_unit_value: [
    'valor unitario cabo',
    'valor unitário cabo',
    'valor cabo',
    'cabo unitario',
    'cabo unitário',
    'r$ por cabo',
    'r$/cabo',
  ],
  vehicles_qty: ['veiculos', 'veículos', 'qtd veiculos', 'qtd veículos'],
  vehicles_cost: [
    'custo veiculos',
    'custo veículos',
    'valor veiculos',
    'valor veículos',
  ],
  fuel_cost: ['combustivel', 'combustível', 'gasolina'],
  materials_cost: [
    'materiais',
    'material',
    'material campanha',
    'materiais campanha',
  ],
  others_cost: ['outros', 'outros custos', 'diversos'],
  // REALIZADO
  coord_value_real: [
    'coordenador real',
    'coord real',
    'custo coord realizado',
    'realizado coordenador',
  ],
  cabos_cost_real: [
    'cabos real',
    'cabos realizado',
    'custo cabos real',
    'realizado cabos',
  ],
  vehicles_cost_real: [
    'veiculos real',
    'veículos real',
    'realizado veiculos',
    'realizado veículos',
  ],
  fuel_cost_real: ['combustivel real', 'combustível real', 'realizado combustivel'],
  materials_cost_real: ['materiais real', 'material real', 'realizado materiais'],
  others_cost_real: ['outros real', 'outros realizado', 'realizado outros'],
  notes: ['observacoes', 'observações', 'obs', 'notas', 'observacao'],
} as const;

type CanonicalField = keyof typeof COLUMN_ALIASES;

// ----------------------------------------------------------------------------
// Normalização e mapeamento dinâmico de cabeçalho
// ----------------------------------------------------------------------------
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Para cada coluna canônica, devolve o cabeçalho real que casou (ou null). */
function buildColumnMap(
  headers: string[],
): Record<CanonicalField, string | null> {
  const map = {} as Record<CanonicalField, string | null>;
  const normalizedHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  for (const field of Object.keys(COLUMN_ALIASES) as CanonicalField[]) {
    const aliases = COLUMN_ALIASES[field].map(norm);
    const match = normalizedHeaders.find((h) => aliases.includes(h.n));
    map[field] = match?.raw ?? null;
  }
  return map;
}

// ----------------------------------------------------------------------------
// Conversões de valor (BR-friendly)
// ----------------------------------------------------------------------------

/** Converte string/number/Date em número, tolerando "1.234,56" e "R$ 1.234,56". */
export function toNumberLoose(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  // Remove R$, espaços, e separadores
  let s = v.trim().replace(/^r\$?\s*/i, '').replace(/\s/g, '');
  // Detecta formato pt-BR (1.234,56) vs en-US (1,234.56)
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // pt-BR: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // en-US ou inteiro: remove vírgulas (milhar)
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toIntLoose(v: unknown): number | null {
  const n = toNumberLoose(v);
  return n == null ? null : Math.max(0, Math.round(n));
}

// ----------------------------------------------------------------------------
// Map de municípios MG (lookup por nome normalizado)
// ----------------------------------------------------------------------------
const MUNI_BY_NAME = (() => {
  const m = new Map<string, { code: string; name: string }>();
  for (const mu of MG_MUNICIPALITIES) m.set(norm(mu.name), mu);
  return m;
})();

// ----------------------------------------------------------------------------
// Parse XLSX → array de objetos (chave = cabeçalho original)
// ----------------------------------------------------------------------------
export interface ParsedXlsx {
  headers: string[];
  rows: Record<string, unknown>[];
  sheetName: string;
}

export async function parseXlsxFile(file: File): Promise<ParsedXlsx> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [], sheetName: '' };
  }
  const sheet = wb.Sheets[sheetName];
  // header:1 → primeira linha vira array de strings (cabeçalhos)
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });
  if (aoa.length === 0) {
    return { headers: [], rows: [], sheetName };
  }
  const headers = (aoa[0] as unknown[]).map((h) => String(h ?? '').trim());
  const rows = aoa.slice(1).map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[h] = (row as unknown[])[i];
    });
    return obj;
  });
  return { headers, rows, sheetName };
}

// ----------------------------------------------------------------------------
// Linha canônica derivada do parser (já com tipos certos)
// ----------------------------------------------------------------------------
export interface CanonicalCityPlanRow {
  city_name: string;
  municipality_code: string | null;
  polo_logistico: string | null;
  meta_votos_2022: number;
  meta_votos_2026: number;
  coord_name: string | null;
  coord_value: number;
  cabos_qty: number;
  cabo_unit_value: number;
  vehicles_qty: number;
  vehicles_cost: number;
  fuel_cost: number;
  materials_cost: number;
  others_cost: number;
  coord_value_real: number | null;
  cabos_cost_real: number | null;
  vehicles_cost_real: number | null;
  fuel_cost_real: number | null;
  materials_cost_real: number | null;
  others_cost_real: number | null;
  notes: string | null;
}

// ----------------------------------------------------------------------------
// Validação + classificação para o preview
// ----------------------------------------------------------------------------

export interface CityPlanImportResult extends ImportRowResult {
  /** Linha canônica pronta para o INSERT (quando status ∈ valid/warning). */
  canonical?: CanonicalCityPlanRow;
}

export function validateCityPlanRows(
  rows: Record<string, unknown>[],
  headers: string[],
  existing: FinanceCityPlan[],
): CityPlanImportResult[] {
  const colMap = buildColumnMap(headers);

  // Lookup de cidades já cadastradas (dedup): por municipality_code OU por city_name normalizado
  const existCodes = new Set<string>();
  const existNames = new Set<string>();
  for (const p of existing) {
    if (p.municipality_code) existCodes.add(p.municipality_code);
    existNames.add(norm(p.city_name));
  }

  // Dedup dentro do próprio arquivo
  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();

  function getStr(row: Record<string, unknown>, field: CanonicalField): string {
    const header = colMap[field];
    if (!header) return '';
    const v = row[header];
    return v == null ? '' : String(v).trim();
  }
  function getNum(row: Record<string, unknown>, field: CanonicalField): number {
    const v = row[colMap[field] ?? ''];
    return toNumberLoose(v) ?? 0;
  }
  function getInt(row: Record<string, unknown>, field: CanonicalField): number {
    const v = row[colMap[field] ?? ''];
    return toIntLoose(v) ?? 0;
  }
  function getNumOrNull(
    row: Record<string, unknown>,
    field: CanonicalField,
  ): number | null {
    const v = row[colMap[field] ?? ''];
    return toNumberLoose(v);
  }

  return rows.map((raw, i): CityPlanImportResult => {
    const line = i + 1;
    const cityRaw = getStr(raw, 'city_name');
    const muni = cityRaw ? MUNI_BY_NAME.get(norm(cityRaw)) : undefined;
    const meta26 = getInt(raw, 'meta_votos_2026');
    const planejado =
      getNum(raw, 'coord_value') +
      getInt(raw, 'cabos_qty') * getNum(raw, 'cabo_unit_value') +
      getNum(raw, 'vehicles_cost') +
      getNum(raw, 'fuel_cost') +
      getNum(raw, 'materials_cost') +
      getNum(raw, 'others_cost');
    const secondary = [muni?.name ?? cityRaw, planejado > 0 ? `R$ ${planejado.toLocaleString('pt-BR')}` : null]
      .filter(Boolean)
      .join(' · ') || undefined;

    // raw em forma string-only para o componente genérico de preview
    const rawAsStrings: Record<string, string> = {};
    for (const h of headers) {
      rawAsStrings[h] = raw[h] == null ? '' : String(raw[h]);
    }

    // ERRO — não importa
    const errors: string[] = [];
    if (!cityRaw) errors.push('Cidade vazia');
    else if (!muni) errors.push(`Cidade "${cityRaw}" não encontrada em MG`);
    if (errors.length) {
      return {
        line,
        raw: rawAsStrings,
        status: 'error',
        primary: cityRaw || '(sem cidade)',
        secondary,
        message: errors.join(' · '),
      };
    }

    // DUPLICADO — não importa
    if (muni) {
      if (existCodes.has(muni.code) || seenCodes.has(muni.code)) {
        return {
          line,
          raw: rawAsStrings,
          status: 'duplicate',
          primary: muni.name,
          secondary,
          message: 'Cidade já cadastrada no planejamento',
        };
      }
      if (existNames.has(norm(muni.name)) || seenNames.has(norm(muni.name))) {
        return {
          line,
          raw: rawAsStrings,
          status: 'duplicate',
          primary: muni.name,
          secondary,
          message: 'Cidade já cadastrada no planejamento (por nome)',
        };
      }
      seenCodes.add(muni.code);
      seenNames.add(norm(muni.name));
    }

    // AVISO — importa com warning
    const warnings: string[] = [];
    if (meta26 === 0) warnings.push('Meta 2026 = 0');
    if (planejado === 0) warnings.push('Sem custos planejados');

    const canonical: CanonicalCityPlanRow = {
      city_name: muni!.name,
      municipality_code: muni!.code,
      polo_logistico: getStr(raw, 'polo_logistico') || null,
      meta_votos_2022: getInt(raw, 'meta_votos_2022'),
      meta_votos_2026: meta26,
      coord_name: getStr(raw, 'coord_name') || null,
      coord_value: getNum(raw, 'coord_value'),
      cabos_qty: getInt(raw, 'cabos_qty'),
      cabo_unit_value: getNum(raw, 'cabo_unit_value'),
      vehicles_qty: getInt(raw, 'vehicles_qty'),
      vehicles_cost: getNum(raw, 'vehicles_cost'),
      fuel_cost: getNum(raw, 'fuel_cost'),
      materials_cost: getNum(raw, 'materials_cost'),
      others_cost: getNum(raw, 'others_cost'),
      coord_value_real: getNumOrNull(raw, 'coord_value_real'),
      cabos_cost_real: getNumOrNull(raw, 'cabos_cost_real'),
      vehicles_cost_real: getNumOrNull(raw, 'vehicles_cost_real'),
      fuel_cost_real: getNumOrNull(raw, 'fuel_cost_real'),
      materials_cost_real: getNumOrNull(raw, 'materials_cost_real'),
      others_cost_real: getNumOrNull(raw, 'others_cost_real'),
      notes: getStr(raw, 'notes') || null,
    };

    return {
      line,
      raw: rawAsStrings,
      status: warnings.length > 0 ? 'warning' : 'valid',
      primary: muni!.name,
      secondary,
      message: warnings.length > 0 ? warnings.join(' · ') : undefined,
      canonical,
    };
  });
}

// ----------------------------------------------------------------------------
// Gera planilha-modelo (.xlsx) com cabeçalhos canônicos + uma linha exemplo
// ----------------------------------------------------------------------------
export function generateXlsxTemplate(): void {
  const headers = [
    'Cidade',
    'Polo Logístico',
    'Votos 2022',
    'Meta 2026',
    'Coordenador',
    'Custo Coordenador',
    'Cabos Eleitorais',
    'Valor Unitário Cabo',
    'Veículos',
    'Custo Veículos',
    'Combustível',
    'Materiais',
    'Outros',
    'Coordenador Real',
    'Cabos Real',
    'Veículos Real',
    'Combustível Real',
    'Materiais Real',
    'Outros Real',
    'Observações',
  ];
  const exampleRow = [
    'Belo Horizonte',
    'RMBH',
    300000,
    420000,
    'João Silva',
    8000,
    50,
    1500,
    3,
    9000,
    4500,
    2500,
    1500,
    '', '', '', '', '', '',
    'Cidade-cabeça da regional',
  ];
  const aoa = [headers, exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planejamento');
  XLSX.writeFile(wb, 'modelo-planejamento-financeiro.xlsx');
}
