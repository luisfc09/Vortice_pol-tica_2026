// ============================================================================
// ReferrerCombobox — selecionar "Indicado por" (migration 046, Fase 1)
// ----------------------------------------------------------------------------
// Combobox dedicado a escolher um Supporter como indicador de outro.
//
// Filtros aplicados (na ordem):
//   1) status === 'ativo'   (só lideranças ativas podem indicar)
//   2) id !== currentId     (não pode indicar a si mesmo — só relevante em edit)
//   3) !isAncestorOf(...)   (não pode escolher alguém que JÁ é descendente —
//                            isso criaria um ciclo: A→B→A)
//
// Busca: mínimo 2 caracteres, case-insensitive, sem acentos. Mostra até
// 50 sugestões (mais que isso polui a UI; campanhas grandes refinam por
// busca).
//
// Quando há valor selecionado: renderiza chip com nome + município +
// papel + botão X pra limpar. Sem valor: input com search.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isAncestorOf } from '@/lib/hierarchy';
import {
  SUPPORTER_ROLE_LABEL,
  type Supporter,
} from '@/types';

const MIN_SEARCH = 2;
const MAX_SUGGESTIONS = 50;

interface Props {
  /** ID atualmente selecionado como indicador (referrer_id). null = nenhum. */
  value: string | null;
  onChange: (referrerId: string | null) => void;
  /** Lista completa de supporters da campanha. */
  supporters: Supporter[];
  /**
   * ID da liderança sendo editada (pra excluir do candidato + anti-loop).
   * null quando o form está criando uma liderança nova (anti-loop não
   * se aplica porque ainda não há nó na árvore).
   */
  currentId: string | null;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function displaySecondary(s: Supporter): string {
  const parts: string[] = [];
  if (s.city) parts.push(s.city);
  const roleLabel =
    s.role === 'outro' && s.role_custom?.trim()
      ? s.role_custom
      : SUPPORTER_ROLE_LABEL[s.role] ?? s.role;
  if (roleLabel) parts.push(roleLabel);
  return parts.join(' · ');
}

export function ReferrerCombobox({
  value,
  onChange,
  supporters,
  currentId,
  id,
  disabled,
  placeholder = 'Buscar liderança…',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(
    () => (value ? supporters.find((s) => s.id === value) ?? null : null),
    [supporters, value],
  );

  // Lista candidata pré-filtros de busca (regras de domínio).
  // Memoizada porque pode ser ordens de magnitude maior em campanhas grandes.
  const candidates = useMemo(() => {
    return supporters.filter((s) => {
      if (s.status !== 'ativo') return false;
      if (currentId && s.id === currentId) return false;
      // Anti-loop: só roda se há currentId (edição). Em criação não há
      // árvore embaixo do nó novo ainda.
      if (currentId && isAncestorOf(supporters, currentId, s.id)) {
        // Se o nó EDITADO é ancestral do candidato, escolher o candidato
        // criaria um ciclo (o candidato já está abaixo do editado).
        return false;
      }
      return true;
    });
  }, [supporters, currentId]);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (q.length < MIN_SEARCH) return [];
    const starts: Supporter[] = [];
    const includes: Supporter[] = [];
    for (const s of candidates) {
      const n = norm(s.name);
      if (n.startsWith(q)) starts.push(s);
      else if (n.includes(q)) includes.push(s);
    }
    return [...starts, ...includes].slice(0, MAX_SUGGESTIONS);
  }, [candidates, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  // Scroll do item ativo pra vista durante navegação por teclado.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLLIElement>(
      `[data-idx="${activeIndex}"]`,
    );
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function commit(s: Supporter) {
    onChange(s.id);
    setOpen(false);
    setQuery('');
  }

  function clear() {
    onChange(null);
    setQuery('');
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (open && filtered[activeIndex]) {
        e.preventDefault();
        commit(filtered[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  // ----------- Modo "selecionado" (chip) ------------------------------
  if (selected && !open) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-vortex-border bg-vortex-surface/40 px-3 py-2 text-sm">
        <UserCheck className="h-4 w-4 shrink-0 text-vortex-violet" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground" title={selected.name}>
            {selected.name}
          </p>
          {displaySecondary(selected) ? (
            <p className="truncate text-xs text-muted-foreground">
              {displaySecondary(selected)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          aria-label="Remover indicador"
          className="rounded-md p-1 text-muted-foreground hover:bg-vortex-bg/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ----------- Modo "buscar" (input + dropdown) -----------------------
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          autoFocus={open}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
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

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-vortex-border bg-vortex-surface shadow-xl">
          {norm(query).length < MIN_SEARCH ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              Digite pelo menos {MIN_SEARCH} letras para buscar.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              Nenhuma liderança encontrada.
              {candidates.length === 0
                ? ' (Nenhuma elegível: precisa estar ativa e fora da própria sub-árvore.)'
                : ''}
            </p>
          ) : (
            <ul ref={listRef} className="max-h-72 overflow-y-auto py-1">
              {filtered.map((s, i) => (
                <li key={s.id} data-idx={i}>
                  <button
                    type="button"
                    onClick={() => commit(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors',
                      i === activeIndex
                        ? 'bg-primary/15 text-foreground'
                        : 'text-foreground/90 hover:bg-vortex-bg/60',
                    )}
                  >
                    <span className="truncate font-medium">{s.name}</span>
                    {displaySecondary(s) ? (
                      <span className="text-xs text-muted-foreground">
                        {displaySecondary(s)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
              {filtered.length === MAX_SUGGESTIONS ? (
                <li className="border-t border-vortex-border px-3 py-2 text-[11px] text-muted-foreground">
                  Mostrando os primeiros {MAX_SUGGESTIONS} — refine a busca para ver mais.
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
