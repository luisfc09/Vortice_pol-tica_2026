import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MG_MUNICIPALITIES } from '@/data/municipalities-mg';

interface Props {
  value: string;
  onChange: (code: string, name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Subset opcional. Se omitido, usa MG_MUNICIPALITIES (853).
   */
  options?: ReadonlyArray<{ code: string; name: string }>;
  id?: string;
}

// Normaliza para busca: minúsculas + sem acentos.
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const MAX_VISIBLE = 80;

export function MunicipalityCombobox({
  value,
  onChange,
  placeholder = 'Buscar município…',
  disabled,
  options,
  id,
}: Props) {
  const list = options ?? MG_MUNICIPALITIES;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(() => list.find((m) => m.code === value), [list, value]);

  // Filtragem por busca, com prefix-boost (item que começa com a query vem antes).
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return list.slice(0, MAX_VISIBLE);
    const starts: { code: string; name: string }[] = [];
    const includes: { code: string; name: string }[] = [];
    for (const m of list) {
      const n = norm(m.name);
      if (n.startsWith(q)) starts.push(m);
      else if (n.includes(q)) includes.push(m);
    }
    return [...starts, ...includes].slice(0, MAX_VISIBLE);
  }, [list, query]);

  // Reseta highlight quando o filtro muda.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Click fora → fecha.
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

  // Scroll do item ativo para a vista durante navegação por teclado.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLLIElement>(
      `[data-idx="${activeIndex}"]`,
    );
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function commit(option: { code: string; name: string }) {
    onChange(option.code, option.name);
    setOpen(false);
    setQuery('');
  }

  function clear() {
    onChange('', '');
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

  const showInput = open;

  return (
    <div ref={containerRef} className="relative">
      {showInput ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
      ) : (
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected?.name ?? placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      )}

      {open ? (
        <div className="absolute left-0 right-0 z-[1300] mt-1 overflow-hidden rounded-md border border-vortex-border bg-vortex-surface/95 shadow-lg backdrop-blur">
          {selected ? (
            <button
              type="button"
              onClick={clear}
              className="flex w-full items-center justify-between border-b border-vortex-border px-3 py-2 text-xs text-muted-foreground hover:bg-vortex-bg/60"
            >
              <span>
                Atual: <strong className="text-foreground">{selected.name}</strong>
              </span>
              <span className="text-red-300">Limpar</span>
            </button>
          ) : null}

          <ul
            ref={listRef}
            role="listbox"
            className="max-h-64 overflow-y-auto py-1 text-sm"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-muted-foreground">
                Nenhum município com “{query}”.
              </li>
            ) : (
              filtered.map((m, idx) => {
                const isActive = idx === activeIndex;
                const isSelected = m.code === value;
                return (
                  <li
                    key={m.code}
                    data-idx={idx}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => {
                      // mousedown para vencer o click-outside.
                      e.preventDefault();
                      commit(m);
                    }}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5',
                      isActive && 'bg-vortex-bg/70',
                    )}
                  >
                    <span className="truncate">{m.name}</span>
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    ) : null}
                  </li>
                );
              })
            )}
            {!query && list.length > MAX_VISIBLE ? (
              <li className="px-3 py-1.5 text-[11px] text-muted-foreground">
                Mostrando {MAX_VISIBLE} de {list.length}. Digite para refinar.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
