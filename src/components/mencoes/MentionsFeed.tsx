import { useMemo, useState } from 'react';
import { SearchBar } from '@/components/data/SearchBar';
import { FilterPill } from '@/components/data/FilterPill';
import { EmptyState } from '@/components/data/EmptyState';
import { MentionCard } from './MentionCard';
import { useCollection, collections } from '@/lib/data';
import type { MentionSource, Sentiment } from '@/types';

type SourceFilter = 'all' | MentionSource;
type SentimentFilter = 'all' | Sentiment;

const SOURCE_LABEL: Record<MentionSource, string> = {
  twitter: 'X',
  google_news: 'Google News',
  manual: 'Manual',
};

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positivo: 'Positivo',
  neutro: 'Neutro',
  negativo: 'Negativo',
};

export function MentionsFeed() {
  const mentions = useCollection(collections.mentions);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [sentiment, setSentiment] = useState<SentimentFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mentions
      .filter((m) => {
        if (source !== 'all' && m.source !== source) return false;
        if (sentiment !== 'all' && m.sentiment !== sentiment) return false;
        if (!q) return true;
        return `${m.content} ${m.author ?? ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at));
  }, [mentions, query, source, sentiment]);

  return (
    <div className="space-y-4">
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Buscar por conteúdo ou autor"
      />

      <div className="space-y-2">
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
          <FilterPill label="Todas as fontes" active={source === 'all'} onClick={() => setSource('all')} />
          {(Object.keys(SOURCE_LABEL) as MentionSource[]).map((s) => (
            <FilterPill
              key={s}
              label={SOURCE_LABEL[s]}
              active={source === s}
              onClick={() => setSource(s)}
            />
          ))}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
          <FilterPill
            label="Todos os sentimentos"
            active={sentiment === 'all'}
            onClick={() => setSentiment('all')}
          />
          {(Object.keys(SENTIMENT_LABEL) as Sentiment[]).map((s) => (
            <FilterPill
              key={s}
              label={SENTIMENT_LABEL[s]}
              active={sentiment === s}
              onClick={() => setSentiment(s)}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'menção' : 'menções'}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma menção encontrada"
          description="Ajuste os filtros ou aguarde o próximo ciclo de coleta."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <MentionCard key={m.id} mention={m} />
          ))}
        </div>
      )}
    </div>
  );
}
