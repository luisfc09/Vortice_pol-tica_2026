import { ExternalLink, Twitter, Newspaper, Pencil } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import type { Mention, MentionSource, Sentiment } from '@/types';

const SOURCE_ICONS: Record<MentionSource, typeof Twitter> = {
  twitter: Twitter,
  google_news: Newspaper,
  manual: Pencil,
};

const SOURCE_LABEL: Record<MentionSource, string> = {
  twitter: 'X (Twitter)',
  google_news: 'Google News',
  manual: 'Inserção manual',
};

const SENTIMENT_BADGE: Record<Sentiment, 'success' | 'secondary' | 'destructive'> = {
  positivo: 'success',
  neutro: 'secondary',
  negativo: 'destructive',
};

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positivo: 'Positivo',
  neutro: 'Neutro',
  negativo: 'Negativo',
};

export function MentionCard({ mention }: { mention: Mention }) {
  const Icon = SOURCE_ICONS[mention.source];
  return (
    <article className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-vortex-bg text-foreground">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="font-medium text-foreground">{mention.author ?? 'Anônimo'}</p>
            <p className="text-muted-foreground">
              {SOURCE_LABEL[mention.source]} ·{' '}
              {formatDistanceToNow(new Date(mention.published_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          </div>
        </div>
        <Badge variant={SENTIMENT_BADGE[mention.sentiment]}>
          {SENTIMENT_LABEL[mention.sentiment]} · {(mention.sentiment_score >= 0 ? '+' : '') + mention.sentiment_score.toFixed(2)}
        </Badge>
      </header>

      <p className="text-sm leading-relaxed text-foreground/90">{mention.content}</p>

      {mention.url ? (
        <a
          href={mention.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Abrir origem <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </article>
  );
}
