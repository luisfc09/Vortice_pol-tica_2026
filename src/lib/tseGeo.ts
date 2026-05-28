// Ponte entre os dados do TSE (código TSE de município + nome) e o GeoJSON
// do mapa (código IBGE de 7 dígitos). Como os dois datasets compartilham o
// NOME do município, fazemos o join por nome normalizado — não precisamos de
// uma tabela externa de-para TSE↔IBGE.
//
// Também concentra a paleta de cores dos partidos pro choropleth.

import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';

// Normaliza nome de município pra casar TSE × IBGE:
//   - maiúsculas
//   - remove acentos (NFD + strip combining marks)
//   - colapsa espaços, tira pontuação leve
export function normalizeMuniName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacríticos (combining marks)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ') // pontuação/hífen viram espaço
    .replace(/\s+/g, ' ')
    .trim();
}

// Exceções conhecidas onde o nome do TSE difere do IBGE. Chave = nome TSE
// normalizado; valor = nome IBGE normalizado. (Lista curta — 851/853 casam
// direto; só estes precisam de-para.)
const NAME_OVERRIDES: Record<string, string> = {
  // TSE "BRAZÓPOLIS" (Z) → IBGE "Brasópolis" (S)
  BRAZOPOLIS: 'BRASOPOLIS',
  // "São Thomé das Letras" casa direto (ambos com TH) — sem override.
};

// Mapa normalizedName → IBGE code (a partir dos 853 municípios do frontend).
const NAME_TO_IBGE: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const muni of MG_MUNICIPALITIES) {
    m.set(normalizeMuniName(muni.name), muni.code);
  }
  return m;
})();

// Resolve o código IBGE a partir do nome do TSE. Retorna null se não casar.
export function tseNomeToIbge(tseNome: string): string | null {
  const norm = normalizeMuniName(tseNome);
  const fixed = NAME_OVERRIDES[norm] ?? norm;
  return NAME_TO_IBGE.get(fixed) ?? null;
}

// ----------------------------------------------------------------------------
// Cores de partidos — paleta pro choropleth e pras legendas.
// Cores aproximadas das identidades visuais dos partidos (2022/2024).
// ----------------------------------------------------------------------------
const PARTY_COLORS: Record<string, string> = {
  PL: '#1E40AF', // azul
  PT: '#DC2626', // vermelho
  PSD: '#16A34A', // verde
  MDB: '#15803D', // verde escuro
  PSDB: '#2563EB', // azul tucano
  UNIÃO: '#1D4ED8', // União Brasil
  'UNIÃO BRASIL': '#1D4ED8',
  UNIAO: '#1D4ED8',
  PP: '#0EA5E9', // azul claro
  REPUBLICANOS: '#1E3A8A',
  PDT: '#F59E0B', // âmbar
  PSB: '#EA580C', // laranja
  PODE: '#16A34A',
  PODEMOS: '#16A34A',
  PSOL: '#CA8A04', // amarelo-mostarda
  AVANTE: '#0D9488', // teal
  PCdoB: '#B91C1C',
  PCDOB: '#B91C1C',
  CIDADANIA: '#DB2777', // rosa
  SOLIDARIEDADE: '#EA580C',
  PV: '#22C55E', // verde claro
  REDE: '#14B8A6',
  PRD: '#7C3AED',
  NOVO: '#EA580C',
  AGIR: '#9333EA',
  PMB: '#9333EA',
  PMN: '#9333EA',
  PRTB: '#9333EA',
  DC: '#9333EA',
  PSTU: '#991B1B',
  PCO: '#991B1B',
  PCB: '#991B1B',
  UP: '#991B1B',
  MOBILIZA: '#9333EA',
  'MOBILIZA NACIONAL': '#9333EA',
};

const PARTY_FALLBACK = '#64748B'; // slate-500 — partido sem cor definida

export function colorForParty(sigla: string | null | undefined): string {
  if (!sigla) return PARTY_FALLBACK;
  const key = sigla.toUpperCase().trim();
  return PARTY_COLORS[key] ?? PARTY_FALLBACK;
}

// Variante de Badge pra situação do candidato (ELEITO / SUPLENTE / etc).
export function situacaoBadgeVariant(
  situacao: string | null | undefined,
): 'success' | 'warning' | 'destructive' | 'outline' {
  if (!situacao) return 'outline';
  const s = situacao.toUpperCase();
  if (s.startsWith('ELEITO') || s.includes('2º TURNO') || s.includes('2 TURNO')) {
    return s.includes('2') && s.includes('TURNO') ? 'warning' : 'success';
  }
  if (s.includes('SUPLENTE')) return 'warning';
  if (s.includes('NÃO ELEITO') || s.includes('NAO ELEITO')) return 'destructive';
  return 'outline';
}

// Dado um conjunto de siglas que aparecem como líderes, devolve a legenda
// (sigla + cor) ordenada por frequência — pro componente de legenda.
export function buildPartyLegend(
  siglas: Array<string | null | undefined>,
): Array<{ sigla: string; color: string; count: number }> {
  const counts = new Map<string, number>();
  for (const s of siglas) {
    const key = (s ?? '—').toUpperCase().trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([sigla, count]) => ({ sigla, color: colorForParty(sigla), count }))
    .sort((a, b) => b.count - a.count);
}
