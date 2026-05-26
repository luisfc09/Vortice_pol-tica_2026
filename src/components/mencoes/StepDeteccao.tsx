import { useMemo } from 'react';
import { Zap, ExternalLink, ChevronRight, Twitter, Newspaper, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { collections, useCollection } from '@/lib/data';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Mention } from '@/types';

interface Props {
  onSelect: (m: Mention) => void;
}

const MS_HOUR = 3_600_000;

const SOURCE_ICON = {
  twitter: Twitter,
  google_news: Newspaper,
  manual: Pencil,
} as const;

export function StepDeteccao({ onSelect }: Props) {
  const mentions = useCollection(collections.mentions);

  const criticas = useMemo(() => {
    const now = Date.now();
    return mentions
      .filter(
        (m) =>
          m.sentiment === 'negativo' && now - +new Date(m.published_at) <= 2 * MS_HOUR,
      )
      .sort((a, b) => a.sentiment_score - b.sentiment_score)
      .slice(0, 10);
  }, [mentions]);

  // Fallback: se não tiver críticas na janela de 2h, mostra as 10 mais negativas
  // recentes (últimas 24h) para o assessor poder treinar mesmo sem urgência.
  const fallback = useMemo(() => {
    if (criticas.length > 0) return [];
    const now = Date.now();
    return mentions
      .filter(
        (m) =>
          m.sentiment === 'negativo' && now - +new Date(m.published_at) <= 24 * MS_HOUR,
      )
      .sort((a, b) => a.sentiment_score - b.sentiment_score)
      .slice(0, 10);
  }, [mentions, criticas]);

  const list = criticas.length > 0 ? criticas : fallback;
  const inWindow = criticas.length > 0;

  return (
    <div className="space-y-4">
      <header>
        <div className="mb-1 flex items-center gap-2">
          <Zap className="h-4 w-4 text-vortex-lime" />
          <span className="text-xs uppercase tracking-widest text-vortex-lime">
            Passo 1 — Detecção e triagem
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {inWindow
            ? `${criticas.length} menções críticas detectadas nas últimas 2 horas.`
            : fallback.length > 0
              ? `Sem urgências na janela de 2h. Mostrando as ${fallback.length} negativas mais recentes (24h).`
              : 'Sem menções negativas no momento — campanha tranquila.'}
        </p>
      </header>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-vortex-border bg-vortex-surface/40 p-8 text-center">
          <p className="text-sm text-foreground">Tudo calmo</p>
          <p className="text-xs text-muted-foreground">
            Aguarde a próxima coleta de menções para usar este módulo.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((m) => {
            const Icon = SOURCE_ICON[m.source];
            return (
              <li
                key={m.id}
                className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">
                      {m.author ?? 'Anônimo'}
                    </span>
                    <span>·</span>
                    <span>{m.source}</span>
                    <span>·</span>
                    <span>
                      {formatDistanceToNow(new Date(m.published_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <Badge variant="destructive">
                    Score {m.sentiment_score.toFixed(2)}
                  </Badge>
                </div>
                <p className="mb-3 text-sm text-foreground/90">"{m.content}"</p>
                <div className="flex items-center justify-between">
                  {m.url ? (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    >
                      Abrir origem <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span />
                  )}
                  <Button size="sm" onClick={() => onSelect(m)}>
                    Responder esta
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
