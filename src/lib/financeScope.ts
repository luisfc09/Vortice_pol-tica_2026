// ============================================================================
// Vórtice — Financeiro: detecção de escopo por cargo
// ----------------------------------------------------------------------------
// O Módulo Financeiro se adapta ao cargo da campanha:
//   • Cargos de cidade única (Prefeito, Vereador) → mostra UMA cidade,
//     "Planejamento da Cidade" (singular).
//   • Cargos com base territorial ampla (Governador, Senador, Deputado
//     Federal/Estadual) → mostra TABELA por cidade, "Planejamento por
//     Cidade" (várias).
//
// Como o campo `office` em campaigns é text livre (vide schema.sql) e
// foi historicamente preenchido com variações ("Prefeito", "PREFEITO",
// "Deputado Estadual", etc.), normalizamos com lowercase + NFD + includes
// pra ser tolerante.
// ============================================================================

// Range Unicode dos combining diacritical marks (0300–036F). Removendo-os
// após NFD obtemos a string sem acentos.
const DIACRITICS = /[̀-ͯ]/g;

/**
 * Normaliza um texto removendo acentos e baixando pra lowercase, para
 * comparações tolerantes a "Vereador", "vereador", "VEREADOR", etc.
 */
function normalize(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(DIACRITICS, '');
}

/**
 * Retorna `true` quando o cargo opera em uma única cidade
 * (Prefeito, Vice-prefeito, Vereador). Falso para Deputado, Senador,
 * Governador — esses planejam por múltiplas cidades.
 *
 * Aceita string vazia / null com fallback `false` (assume multi-cidade
 * por padrão, que é o caso mais comum em campanhas estaduais).
 */
export function isSingleCityScope(office: string | null | undefined): boolean {
  if (!office) return false;
  const o = normalize(office);
  return o.includes('prefeito') || o.includes('vereador');
}

/**
 * Label do bloco "Planejamento" no módulo financeiro, de acordo com o
 * cargo. Usado no título da aba e em headings.
 */
export function getFinanceLabel(office: string | null | undefined): {
  planejamentoTitle: string;
  planejamentoSubtitle: string;
} {
  if (isSingleCityScope(office)) {
    return {
      planejamentoTitle: 'Planejamento da Cidade',
      planejamentoSubtitle: 'Custos previstos e realizados da operação.',
    };
  }
  return {
    planejamentoTitle: 'Planejamento por Cidade',
    planejamentoSubtitle:
      'Distribuição do orçamento entre os municípios da campanha.',
  };
}
