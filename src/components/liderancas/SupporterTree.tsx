// ============================================================================
// SupporterTree — visualização em árvore da rede de Lideranças (H5).
// ----------------------------------------------------------------------------
// Renderiza a hierarquia de supporters com CSS puro (divs aninhadas) — sem
// dependência nova de tree library. Comporta-se bem até ~2k nós; árvores
// gigantes (>10k) podem precisar de virtualização no futuro.
//
// Recursos:
//   • Toggle expandir/colapsar por nó (▶ / ▼)
//   • Todos iniciam EXPANDIDOS (mais útil em campanhas pequenas/médias)
//   • Click no card abre o sheet de edição (callback)
//   • Busca: destaca nós que matcham + expande automaticamente ancestrais
//   • Indentação 24px/nível + linha vertical conectando pai→filhos
//   • 3 cards de métricas no topo (total, potencial total, profundidade)
//   • Empty state quando a campanha não tem hierarquia (todos raízes)
// ============================================================================

import { useMemo, useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Target,
  UsersRound,
  Users,
  Award,
  Layers,
  Sparkles,
  GitBranch,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  buildForest,
  classifyInfluencia,
  computePipScore,
  getAncestors,
  indexByParent,
  type TreeNode,
} from '@/lib/hierarchy';
import {
  NIVEL_INFLUENCIA_LABEL,
  SUPPORTER_ROLE_LABEL,
  type NivelInfluencia,
  type Supporter,
} from '@/types';

// Cores do badge de nível de influência. Escala "metal" implícita:
//   baixo  = cinza (bronze básico)
//   medio  = sky  (prata)
//   alto   = âmbar (ouro)
//   muito_alto = violeta (diamante / topo)
const NIVEL_BADGE_CLASS: Record<NivelInfluencia, string> = {
  baixo: 'border-slate-500/30 bg-slate-500/15 text-slate-300',
  medio: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
  alto: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  muito_alto: 'border-vortex-violet/40 bg-vortex-violet/15 text-vortex-violet',
};

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  supporters: Supporter[];
  /** Callback ao clicar no card do nó — abre a ficha de edição existente. */
  onOpen: (s: Supporter) => void;
}

export function SupporterTree({ supporters, onOpen }: Props) {
  // -------- estado: busca, expandidos manualmente colapsados ---------
  const [query, setQuery] = useState('');
  // Set de IDs que o usuário COLAPSOU manualmente. Comportamento padrão:
  // tudo expandido. Mais barato manter um Set de exceções do que o set
  // gigante de "está expandido".
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ----- floresta + lookups -------------------------------------------
  const forest = useMemo(() => buildForest(supporters), [supporters]);
  const byParent = useMemo(() => indexByParent(supporters), [supporters]);
  // Conta de filhos diretos por id (pra badge rápida)
  const directCountById = useMemo(() => {
    const m = new Map<string, number>();
    for (const [pid, kids] of byParent) m.set(pid, kids.length);
    return m;
  }, [byParent]);

  // ----- métricas globais ---------------------------------------------
  // Total = supporters; Potencial total = soma de vote_potential;
  // Profundidade máxima = maior depth em qualquer árvore da floresta;
  // Raízes = número de top-level (sem referrer_id).
  const metrics = useMemo(() => {
    const total = supporters.length;
    let potencialTotal = 0;
    for (const s of supporters) potencialTotal += s.vote_potential ?? 0;
    let maxDepth = 0;
    function walk(node: TreeNode) {
      if (node.depth > maxDepth) maxDepth = node.depth;
      node.children.forEach(walk);
    }
    forest.forEach(walk);
    const roots = forest.length;
    return { total, potencialTotal, maxDepth, roots };
  }, [supporters, forest]);

  // ----- busca: ids que matcham + ids que devem estar expandidos -----
  const search = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) {
      return { matches: new Set<string>(), forceExpand: new Set<string>() };
    }
    const matches = new Set<string>();
    for (const s of supporters) if (norm(s.name).includes(q)) matches.add(s.id);
    // Ancestrais dos matchs devem ser auto-expandidos pra match ser visível
    const forceExpand = new Set<string>();
    for (const id of matches) {
      for (const a of getAncestors(supporters, id)) forceExpand.add(a.id);
    }
    return { matches, forceExpand };
  }, [query, supporters]);

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isExpanded(id: string): boolean {
    // Busca ativa força expansão dos ancestrais — sobrescreve collapse manual
    if (search.forceExpand.has(id)) return true;
    return !collapsed.has(id);
  }

  // ----- empty state (todos são raízes — nenhuma indicação) ----------
  const hasAnyHierarchy = useMemo(
    () => supporters.some((s) => s.referrer_id !== null),
    [supporters],
  );

  return (
    <div className="space-y-4">
      {/* Métricas — 4 cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Total na rede"
          value={metrics.total.toLocaleString('pt-BR')}
          accent="text-primary"
        />
        <MetricCard
          icon={Target}
          label="Potencial total"
          value={`${metrics.potencialTotal.toLocaleString('pt-BR')} votos`}
          accent="text-vortex-violet"
        />
        <MetricCard
          icon={Layers}
          label="Profundidade máxima"
          value={`${metrics.maxDepth + 1} ${metrics.maxDepth === 0 ? 'nível' : 'níveis'}`}
          accent="text-amber-400"
        />
        <MetricCard
          icon={GitBranch}
          label="Raízes"
          value={`${metrics.roots} ${metrics.roots === 1 ? 'liderança' : 'lideranças'}`}
          accent="text-sky-400"
        />
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar na rede..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8 pr-8"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Árvore */}
      {!hasAnyHierarchy ? (
        <div className="rounded-xl border border-dashed border-vortex-border bg-vortex-surface/40 p-8 text-center backdrop-blur">
          <Sparkles className="mx-auto mb-3 h-6 w-6 text-vortex-violet" />
          <p className="font-medium text-foreground">
            Nenhuma hierarquia definida ainda.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite uma liderança e defina quem a indicou para montar a rede.
          </p>
        </div>
      ) : (
        <div className="space-y-1 rounded-xl border border-vortex-border bg-vortex-surface/40 p-3 backdrop-blur">
          {forest.map((root) => (
            <TreeNodeRow
              key={root.supporter.id}
              node={root}
              supporters={supporters}
              isExpanded={isExpanded}
              onToggle={toggleCollapsed}
              onOpen={onOpen}
              directCountById={directCountById}
              searchMatches={search.matches}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Subcomponentes
// ----------------------------------------------------------------------------

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className={cn('h-3.5 w-3.5', accent)} />
        {label}
      </div>
      <div className={cn('mt-2 font-display text-2xl', accent)}>{value}</div>
    </div>
  );
}

interface RowProps {
  node: TreeNode;
  supporters: Supporter[];
  isExpanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  onOpen: (s: Supporter) => void;
  directCountById: Map<string, number>;
  searchMatches: Set<string>;
}

function TreeNodeRow({
  node,
  supporters,
  isExpanded,
  onToggle,
  onOpen,
  directCountById,
  searchMatches,
}: RowProps) {
  const s = node.supporter;
  const hasChildren = node.children.length > 0;
  const expanded = isExpanded(s.id);
  const isMatch = searchMatches.has(s.id);

  const directCount = directCountById.get(s.id) ?? 0;
  const pip = useMemo(() => computePipScore(supporters, s.id), [supporters, s.id]);
  const nivel = classifyInfluencia(pip);

  const roleLabel =
    s.role === 'outro' && s.role_custom?.trim()
      ? s.role_custom
      : SUPPORTER_ROLE_LABEL[s.role] ?? s.role;

  return (
    <div>
      <div
        className={cn(
          'flex items-start gap-2 rounded-lg border border-transparent p-2 transition-colors hover:bg-vortex-bg/40',
          isMatch && 'border-vortex-violet/50 bg-vortex-violet/10',
        )}
        style={{ marginLeft: node.depth * 24 }}
      >
        {/* Botão de expand/collapse (ou espaçador) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(s.id);
          }}
          aria-label={hasChildren ? (expanded ? 'Colapsar' : 'Expandir') : undefined}
          className={cn(
            'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground',
            hasChildren && 'hover:bg-vortex-surface hover:text-foreground',
            !hasChildren && 'opacity-30',
          )}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Card clicável do nó */}
        <button
          type="button"
          onClick={() => onOpen(s)}
          className="min-w-0 flex-1 rounded-md text-left transition-colors"
        >
          <div className="flex items-start gap-3">
            {/* Avatar com inicial */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vortex-bg/60 font-display text-sm text-vortex-violet">
              {initials(s.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground" title={s.name}>
                {s.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[s.city, roleLabel].filter(Boolean).join(' · ')}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {s.vote_potential != null && s.vote_potential > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-vortex-violet/40 bg-vortex-violet/15 px-1.5 py-0.5 text-[10px] font-medium text-vortex-violet">
                    <Target className="h-2.5 w-2.5" />
                    {s.vote_potential.toLocaleString('pt-BR')} votos
                  </span>
                ) : null}
                {directCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                    <UsersRound className="h-2.5 w-2.5" />
                    {directCount} indic.
                  </span>
                ) : null}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                    NIVEL_BADGE_CLASS[nivel],
                  )}
                  title={`pip_score ${pip.toFixed(1)}`}
                >
                  <Award className="h-2.5 w-2.5" />
                  {NIVEL_INFLUENCIA_LABEL[nivel]}
                </span>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Filhos (recursivo) — linha vertical conectora via border-l */}
      {expanded && hasChildren ? (
        <div
          className="border-l border-vortex-border/50"
          style={{ marginLeft: node.depth * 24 + 18 }}
        >
          <div style={{ marginLeft: -18 }}>
            {node.children.map((c) => (
              <TreeNodeRow
                key={c.supporter.id}
                node={c}
                supporters={supporters}
                isExpanded={isExpanded}
                onToggle={onToggle}
                onOpen={onOpen}
                directCountById={directCountById}
                searchMatches={searchMatches}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
