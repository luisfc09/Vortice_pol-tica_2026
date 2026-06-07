// ============================================================================
// Vórtice — Hierarquia de Lideranças (Fase 1)
// ----------------------------------------------------------------------------
// Funções puras sobre a árvore de lideranças formada por `referrer_id`.
// Operam sobre a lista plana já carregada via useCollection(supporters) —
// não fazem queries. Performam bem até ~10k supporters por campanha.
//
// Vocabulário:
//   • root: supporter sem referrer_id (raiz da árvore).
//   • children: supporters cujo referrer_id == um id dado (diretos, 1 nível).
//   • descendants: children + descendants de children (recursivo, todos os
//     níveis abaixo).
//   • ancestors: referrer + referrer do referrer ... até a raiz.
//   • depth: distância em níveis até a raiz (root = 0).
//
// Anti-loop: por construção da árvore (1 pai só, criação one-at-a-time),
// loops só surgem por erro do usuário no UPDATE. Use isAncestorOf() no
// SupporterFormSheet pra impedir antes de salvar.
// ============================================================================

import type { NivelInfluencia, Supporter } from '@/types';

// ----------------------------------------------------------------------------
// Índices internos (memoizáveis por chamadores via useMemo)
// ----------------------------------------------------------------------------

/**
 * Map { id → supporter } para lookup O(1).
 */
export function indexById(supporters: Supporter[]): Map<string, Supporter> {
  const m = new Map<string, Supporter>();
  for (const s of supporters) m.set(s.id, s);
  return m;
}

/**
 * Map { parentId → children[] } para navegação descendente O(1) por parent.
 * Supporters com referrer_id null NÃO entram (use getRoots() pra eles).
 */
export function indexByParent(supporters: Supporter[]): Map<string, Supporter[]> {
  const m = new Map<string, Supporter[]>();
  for (const s of supporters) {
    if (!s.referrer_id) continue;
    const arr = m.get(s.referrer_id);
    if (arr) arr.push(s);
    else m.set(s.referrer_id, [s]);
  }
  return m;
}

// ----------------------------------------------------------------------------
// Consultas básicas
// ----------------------------------------------------------------------------

export function getRoots(supporters: Supporter[]): Supporter[] {
  return supporters.filter((s) => s.referrer_id === null);
}

export function getDirectChildren(
  supporters: Supporter[],
  parentId: string,
): Supporter[] {
  return supporters.filter((s) => s.referrer_id === parentId);
}

/**
 * Todos os descendentes (recursivo). Inclui o nó-raiz se passado em `include`.
 * Itera com fila para evitar stack overflow em árvores muito profundas.
 */
export function getDescendants(
  supporters: Supporter[],
  rootId: string,
  options: { includeRoot?: boolean } = {},
): Supporter[] {
  const byParent = indexByParent(supporters);
  const byId = indexById(supporters);
  const out: Supporter[] = [];
  const seen = new Set<string>();
  const queue: string[] = [rootId];

  if (options.includeRoot) {
    const root = byId.get(rootId);
    if (root) {
      out.push(root);
      seen.add(rootId);
    }
  } else {
    seen.add(rootId); // não inclui mas previne loop
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    const kids = byParent.get(id) ?? [];
    for (const k of kids) {
      if (seen.has(k.id)) continue; // proteção contra loops
      seen.add(k.id);
      out.push(k);
      queue.push(k.id);
    }
  }
  return out;
}

/**
 * Lista ancestrais do mais próximo (pai direto) ao mais distante (raiz).
 * Para se entrar em loop (proteção contra dados ruins).
 */
export function getAncestors(
  supporters: Supporter[],
  startId: string,
): Supporter[] {
  const byId = indexById(supporters);
  const out: Supporter[] = [];
  const seen = new Set<string>([startId]);
  let cur = byId.get(startId);
  while (cur?.referrer_id) {
    if (seen.has(cur.referrer_id)) break;
    const parent = byId.get(cur.referrer_id);
    if (!parent) break;
    out.push(parent);
    seen.add(parent.id);
    cur = parent;
  }
  return out;
}

/**
 * `true` se `ancestorId` está em algum lugar na cadeia de ancestrais de
 * `descendantId` (ou é o próprio). Use para impedir ciclos no form:
 * "Indicado por" NÃO pode ser o próprio nó nem qualquer descendente dele.
 *
 * Equivalente:
 *   isAncestorOf(supporters, candidato, supporterEditado)
 * Se TRUE → mostrar erro: "esta liderança já é descendente da escolhida".
 *
 * Implementação eficiente: usa o índice byParent partindo do ancestor e
 * descendo. Mais barato que percorrer ancestrais ascendentes do descendant.
 */
export function isAncestorOf(
  supporters: Supporter[],
  ancestorId: string,
  descendantId: string,
): boolean {
  if (ancestorId === descendantId) return true;
  const byParent = indexByParent(supporters);
  const queue: string[] = [ancestorId];
  const seen = new Set<string>([ancestorId]);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const kids = byParent.get(id) ?? [];
    for (const k of kids) {
      if (k.id === descendantId) return true;
      if (seen.has(k.id)) continue;
      seen.add(k.id);
      queue.push(k.id);
    }
  }
  return false;
}

/**
 * Profundidade do nó na árvore (raiz = 0). Conta seguindo referrer_id até
 * a raiz. Para em loop.
 */
export function getDepth(supporters: Supporter[], id: string): number {
  return getAncestors(supporters, id).length;
}

/**
 * Quantos descendentes diretos (filhos imediatos) o supporter tem.
 * Usado no card: badge "👥 N indicações".
 */
export function getDirectChildrenCount(
  supporters: Supporter[],
  id: string,
): number {
  // Conta inline (sem alocar array) — mais eficiente quando só preciso do N.
  let n = 0;
  for (const s of supporters) if (s.referrer_id === id) n++;
  return n;
}

// ----------------------------------------------------------------------------
// pip_score & nivel_influencia (calculados no frontend)
// ----------------------------------------------------------------------------

/**
 * Decay aplicado a cada nível descendente. 0.8 = neto vale 64%, bisneto 51%.
 * Configurável aqui se a fórmula precisar evoluir.
 */
const PIP_DECAY = 0.8;

/**
 * pip_score = soma do vote_potential do supporter (peso 1.0) + de cada
 * descendente com decay 0.8^depth_relativo_ao_supporter.
 *
 * Exemplo (vote_potential = 10 em cada):
 *   - próprio (depth 0): 10 × 1.0 = 10
 *   - 3 filhos diretos (depth 1): 3 × 10 × 0.8 = 24
 *   - 9 netos (depth 2): 9 × 10 × 0.64 = 57.6
 *   pip_score = 91.6
 */
export function computePipScore(
  supporters: Supporter[],
  supporterId: string,
): number {
  const byParent = indexByParent(supporters);
  const byId = indexById(supporters);
  const root = byId.get(supporterId);
  if (!root) return 0;

  // BFS por nível pra aplicar o decay correto sem recursão profunda.
  let total = (root.vote_potential ?? 0) * 1.0;
  let currentLevel: Supporter[] = byParent.get(supporterId) ?? [];
  let depth = 1;
  const seen = new Set<string>([supporterId]);

  while (currentLevel.length > 0) {
    const weight = Math.pow(PIP_DECAY, depth);
    const nextLevel: Supporter[] = [];
    for (const s of currentLevel) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      total += (s.vote_potential ?? 0) * weight;
      const kids = byParent.get(s.id);
      if (kids) nextLevel.push(...kids);
    }
    currentLevel = nextLevel;
    depth++;
  }

  return Math.round(total * 100) / 100; // 2 casas
}

/**
 * Classificação textual derivada do pip_score. Faixas conservadoras —
 * ajuste em uma feature de "Configurações" no futuro, se a campanha
 * quiser calibrar.
 */
export function classifyInfluencia(pipScore: number): NivelInfluencia {
  if (pipScore < 50) return 'baixo';
  if (pipScore < 200) return 'medio';
  if (pipScore < 500) return 'alto';
  return 'muito_alto';
}

// ----------------------------------------------------------------------------
// Estruturas de árvore (pra visualizações)
// ----------------------------------------------------------------------------

export interface TreeNode {
  supporter: Supporter;
  depth: number;
  children: TreeNode[];
}

/**
 * Constrói a floresta (lista de árvores enraizadas) a partir da lista plana.
 * Cada árvore começa em uma `root` (referrer_id null).
 *
 * Detecta órfãos (referrer_id apontando pra um id que não está na lista,
 * ex.: liderança excluída do snapshot por filtro/RLS) — esses entram como
 * roots adicionais pra não sumirem da visualização.
 */
export function buildForest(supporters: Supporter[]): TreeNode[] {
  const byParent = indexByParent(supporters);
  const byId = indexById(supporters);

  function build(s: Supporter, depth: number, seen: Set<string>): TreeNode {
    seen.add(s.id);
    const kids = (byParent.get(s.id) ?? [])
      .filter((k) => !seen.has(k.id))
      .map((k) => build(k, depth + 1, seen));
    return { supporter: s, depth, children: kids };
  }

  const roots = supporters.filter(
    (s) => !s.referrer_id || !byId.has(s.referrer_id),
  );
  const seen = new Set<string>();
  return roots.map((r) => build(r, 0, seen));
}
