import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { CampaignIntelligence } from '@/types';

interface Props {
  intelligence: CampaignIntelligence;
}

interface Highlight {
  label: string;
  category: string;
  pct: number;
  count: number;
  tone: 'positive' | 'negative' | 'neutral';
}

// Encontra as linhas com maior % de apoio e maior % de indecisão pra
// destacar como "mais favoráveis" e "mais indecisos" no card.
function findHighlights(intel: CampaignIntelligence): {
  favoraveis: Highlight[];
  indecisos: Highlight[];
} {
  const favoraveis: Highlight[] = [];
  const indecisos: Highlight[] = [];

  function scan(
    rows: CampaignIntelligence['crossings']['intention_by_age'],
    category: string,
  ) {
    for (const row of rows) {
      if (row.total < 8) continue; // amostra pequena → ruído
      const apoio = row.cells.find((c) => /apoiador$/i.test(c.colKey));
      const indeciso = row.cells.find((c) => /indeciso/i.test(c.colKey));
      if (apoio) {
        favoraveis.push({
          label: row.rowKey,
          category,
          pct: apoio.pct,
          count: apoio.count,
          tone: 'positive',
        });
      }
      if (indeciso) {
        indecisos.push({
          label: row.rowKey,
          category,
          pct: indeciso.pct,
          count: indeciso.count,
          tone: 'neutral',
        });
      }
    }
  }

  scan(intel.crossings.intention_by_gender, 'Gênero');
  scan(intel.crossings.intention_by_age, 'Idade');
  scan(intel.crossings.intention_by_religion, 'Religião');
  scan(intel.crossings.intention_by_income, 'Renda');

  favoraveis.sort((a, b) => b.pct - a.pct);
  indecisos.sort((a, b) => b.pct - a.pct);
  return {
    favoraveis: favoraveis.slice(0, 4),
    indecisos: indecisos.slice(0, 4),
  };
}

export function CruzamentosEstrategicos({ intelligence }: Props) {
  const { favoraveis, indecisos } = useMemo(() => findHighlights(intelligence), [intelligence]);

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
      <h3 className="font-display text-lg tracking-wide text-foreground">
        Cruzamentos estratégicos
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Recortes do eleitorado por perfil
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CategoryList
          title="Mais favoráveis"
          tone="positive"
          items={favoraveis}
        />
        <CategoryList title="Mais indecisos" tone="neutral" items={indecisos} />
      </div>
    </div>
  );
}

function CategoryList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: Highlight['tone'];
  items: Highlight[];
}) {
  const toneClasses = {
    positive: 'text-emerald-300',
    negative: 'text-red-300',
    neutral: 'text-amber-300',
  } as const;
  return (
    <div className="rounded-lg border border-vortex-border bg-vortex-bg/40 p-3">
      <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados suficientes ainda.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {items.map((h, i) => (
            <li key={`${h.category}-${h.label}-${i}`} className="flex items-center justify-between gap-2">
              <span className="text-foreground">
                <span className="text-xs text-muted-foreground">{h.category}:</span>{' '}
                {h.label}
              </span>
              <span className={cn('font-mono text-xs', toneClasses[tone])}>
                {h.pct}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
