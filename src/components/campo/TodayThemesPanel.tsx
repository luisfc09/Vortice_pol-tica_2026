import { Link } from 'react-router-dom';
import { Lightbulb, ListChecks, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { findSuggestionFor, type ThemeRow } from '@/lib/campo-hoje';

interface Props {
  themes: ThemeRow[];
}

export function TodayThemesPanel({ themes }: Props) {
  const top = themes[0];
  const suggestion = findSuggestionFor(top?.theme);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-5 backdrop-blur">
        <div className="mb-4 flex items-start gap-2">
          <ListChecks className="mt-0.5 h-4 w-4 text-vortex-violet" />
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Temas mais citados hoje
            </p>
            <p className="font-display text-xl tracking-wide text-foreground">
              Pauta do dia
            </p>
          </div>
        </div>

        {themes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-vortex-border bg-vortex-bg/40 p-6 text-center text-sm text-muted-foreground">
            Sem temas marcados nas entrevistas de hoje.
          </p>
        ) : (
          <ul className="space-y-3">
            {themes.map((t, idx) => (
              <li key={t.theme} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-vortex-violet/15 text-[11px] font-semibold text-vortex-violet">
                      {idx + 1}
                    </span>
                    <span className="text-foreground">{t.theme}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.count} menç{t.count === 1 ? 'ão' : 'ões'} · {Math.round(t.pct)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-vortex-bg">
                  <div
                    className="h-full bg-gradient-to-r from-vortex-violet to-vortex-lime transition-all duration-500"
                    style={{ width: `${Math.min(100, t.pct)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {top && suggestion ? (
        <div className="vortex-glow rounded-xl border border-primary/40 bg-primary/10 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium uppercase tracking-widest text-primary">
              Sugestão para amanhã
            </p>
          </div>
          <p className="font-display text-lg tracking-wide text-foreground">{top.theme}</p>
          <p className="mt-1 text-sm text-foreground/90">{suggestion}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="default" size="sm">
              <Link to="/agenda">
                Abrir agenda <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/campo/faq">
                Argumentação relacionada
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
