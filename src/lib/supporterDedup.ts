// ============================================================================
// supporterDedup — detecção de cadastros duplicados de apoiadores.
// ----------------------------------------------------------------------------
// Usado pelo AddSupporterSheet em /minha-rede pra evitar que o mesmo
// apoiador seja cadastrado N vezes pela rede de supporters/leaders.
//
// Estratégia em 3 camadas (ordem de prioridade):
//   1. WhatsApp exato — mais confiável (10/11 dígitos único por pessoa)
//   2. Telefone exato — fallback se whatsapp não foi informado
//   3. Nome similar + mesmo município — heurística pra "João da Silva" /
//      "Joao Da Silva" que digitam-se diferente mas são a mesma pessoa
//
// Normalização de telefone: remove tudo exceto dígitos e descasca o prefixo
// 55 (DDI Brasil) quando o número tem 13 dígitos. Isso casa "+55 31 99999-1111"
// com "31999991111".
//
// Comparação de nome usa `normText` do csv-import.ts (NFD + lowercase + trim)
// pra ser tolerante a acentos e capitalização.
//
// O lookup do nome de quem CRIOU o supporter duplicado vem de `profiles`
// (campo full_name) — feito sob demanda apenas quando há match, pra não
// pagar SELECT extra no caso comum (sem duplicata).
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { normText, onlyDigits } from '@/lib/csv-import';

/** Tipo de match encontrado — usado na UI pra explicar o motivo da duplicata. */
export type DuplicateMatchType = 'whatsapp_exact' | 'phone_exact' | 'name_city';

export interface DuplicateMatch {
  /** Nome cadastrado (como salvo no banco). */
  name: string;
  /** Cidade cadastrada (campo `city` do supporter). */
  city: string;
  /** Nome de quem cadastrou (de profiles.full_name; pode ser '—' se profile vazio). */
  createdByName: string;
  /** ISO timestamp do created_at do supporter duplicado. */
  createdAt: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchType: DuplicateMatchType | null;
  /** Dados do supporter duplicado (null se não há duplicata). */
  existingSupporter: DuplicateMatch | null;
}

/**
 * Normaliza um número de telefone pra comparação.
 *
 * Regras:
 *   • Remove tudo que não é dígito.
 *   • Se sobrar 13 dígitos começando com 55 (DDI Brasil), tira o 55.
 *   • Caso contrário devolve só os dígitos.
 *
 * Exemplos:
 *   "+55 (31) 99999-1111"  →  "31999991111"
 *   "(31) 9 9999-1111"     →  "31999991111"
 *   "31999991111"          →  "31999991111"
 *   "999991111"            →  "999991111"   (sem DDD — não recupera, mas
 *                                            também não casa errado)
 */
export function normalizePhone(phone: string | null | undefined): string {
  const digits = onlyDigits(phone ?? '');
  if (digits.length === 13 && digits.startsWith('55')) return digits.slice(2);
  return digits;
}

/**
 * Normaliza um nome pra comparação tolerante a acento/caixa.
 * Alias semântico de `normText` (que já faz NFD + lowercase + trim) —
 * mantido como função separada pra ficar explícito que estamos
 * comparando NOMES (não telefones, não emails).
 */
export function normalizeName(name: string | null | undefined): string {
  return normText(name);
}

interface CheckInput {
  name: string;
  whatsapp?: string | null;
  phone?: string | null;
  city: string;
  municipalityCode?: string | null;
  /**
   * ID do supporter sendo editado (modo EDIÇÃO). Linhas com este id são
   * IGNORADAS na busca de duplicata — caso contrário um supporter casaria
   * consigo mesmo ao editar.
   */
  excludeId?: string | null;
}

/**
 * Procura por um supporter já cadastrado na campanha que seja "o mesmo"
 * que o input. Devolve `isDuplicate: false` se passou nas 3 camadas.
 *
 * Faz 1 SELECT em `supporters` filtrado por campaign_id (RLS aplica). Se
 * achar match, faz +1 SELECT em `profiles` pra resolver o nome de quem
 * cadastrou. Total: 1-2 round-trips ao banco por chamada.
 */
export async function checkDuplicate(
  supabase: SupabaseClient,
  campaignId: string,
  data: CheckInput,
): Promise<DuplicateCheckResult> {
  // Busca todos os supporters da campanha (RLS já filtra por campanha do
  // usuário, mas mantemos o .eq por defesa em profundidade).
  const { data: existing, error } = await supabase
    .from('supporters')
    .select('id, name, city, whatsapp, phone, municipality_code, created_at, created_by')
    .eq('campaign_id', campaignId);

  if (error || !existing) {
    return { isDuplicate: false, matchType: null, existingSupporter: null };
  }

  // No modo edição, excluir o próprio registro pra não casar consigo mesmo.
  const candidates = data.excludeId
    ? existing.filter((s) => s.id !== data.excludeId)
    : existing;

  if (candidates.length === 0) {
    return { isDuplicate: false, matchType: null, existingSupporter: null };
  }

  // ---- Camada 1: WhatsApp exato --------------------------------------
  if (data.whatsapp) {
    const norm = normalizePhone(data.whatsapp);
    if (norm.length >= 8) {
      // só compara se temos pelo menos 8 dígitos (evita match com strings vazias)
      const match = candidates.find(
        (s) => s.whatsapp && normalizePhone(s.whatsapp) === norm,
      );
      if (match) return await buildResult(supabase, 'whatsapp_exact', match);
    }
  }

  // ---- Camada 2: Telefone exato --------------------------------------
  if (data.phone) {
    const norm = normalizePhone(data.phone);
    if (norm.length >= 8) {
      const match = candidates.find(
        (s) => s.phone && normalizePhone(s.phone) === norm,
      );
      if (match) return await buildResult(supabase, 'phone_exact', match);
    }
  }

  // ---- Camada 3: Nome similar + mesmo município ----------------------
  const normName = normalizeName(data.name);
  if (normName.length >= 3) {
    const match = candidates.find((s) => {
      const sameName = normalizeName(s.name) === normName;
      if (!sameName) return false;
      // Prefere comparar por municipality_code (mais confiável que o nome
      // livre da cidade). Cai pro nome quando o code não foi informado.
      const sameCity = data.municipalityCode
        ? s.municipality_code === data.municipalityCode
        : normalizeName(s.city ?? '') === normalizeName(data.city);
      return sameCity;
    });
    if (match) return await buildResult(supabase, 'name_city', match);
  }

  return { isDuplicate: false, matchType: null, existingSupporter: null };
}

/**
 * Monta o resultado positivo de duplicata. Resolve o nome de quem cadastrou
 * via profiles (1 SELECT extra). Falha silenciosa: se a busca do profile
 * der erro, devolve '—' como nome.
 */
async function buildResult(
  supabase: SupabaseClient,
  matchType: DuplicateMatchType,
  match: {
    name: string;
    city: string | null;
    created_at: string;
    created_by: string;
  },
): Promise<DuplicateCheckResult> {
  let createdByName = '—';
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', match.created_by)
    .maybeSingle();
  if (profile?.full_name) createdByName = profile.full_name;

  return {
    isDuplicate: true,
    matchType,
    existingSupporter: {
      name: match.name,
      city: match.city ?? '—',
      createdByName,
      createdAt: match.created_at,
    },
  };
}
