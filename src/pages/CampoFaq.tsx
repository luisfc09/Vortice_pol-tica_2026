import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FaqCard } from '@/components/field/FaqCard';
import { FAQ_SEED } from '@/data/faq-seed';
import { FAQ_CATEGORY_LABEL, type FaqCategory } from '@/types';
import { cn } from '@/lib/utils';

type CategoryFilter = 'all' | FaqCategory;

export default function CampoFaqPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ_SEED.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false;
      if (!q) return true;
      const haystack = `${item.question} ${item.suggested_answer} ${item.support_data} ${item.avoid_saying}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, filter]);

  const categories: { value: CategoryFilter; label: string; count: number }[] = useMemo(() => {
    const all: CategoryFilter[] = ['all', ...(Object.keys(FAQ_CATEGORY_LABEL) as FaqCategory[])];
    return all.map((c) => ({
      value: c,
      label: c === 'all' ? 'Todas' : FAQ_CATEGORY_LABEL[c],
      count:
        c === 'all'
          ? FAQ_SEED.length
          : FAQ_SEED.filter((item) => item.category === c).length,
    }));
  }, []);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to="/campo">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por palavra-chave (ex: SUS, segurança, agronegócio)"
          className="pl-9"
        />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => {
          const active = filter === c.value;
          return (
            <button
              type="button"
              key={c.value}
              onClick={() => setFilter(c.value)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-vortex-border bg-vortex-surface/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {c.label} · {c.count}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'} · funciona offline
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filtered.map((item, idx) => (
          <FaqCard
            key={`${item.category}-${idx}`}
            category={item.category}
            question={item.question}
            suggestedAnswer={item.suggested_answer}
            supportData={item.support_data}
            avoidSaying={item.avoid_saying}
          />
        ))}
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-vortex-border bg-vortex-surface/30 p-8 text-center text-sm text-muted-foreground">
            Nenhum card encontrado. Tente outra palavra-chave ou categoria.
          </div>
        ) : null}
      </div>
    </div>
  );
}
