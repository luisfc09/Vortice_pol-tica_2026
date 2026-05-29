import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCustomQuestionsAnalytics } from '@/hooks/useCustomQuestionsAnalytics';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import type { QuestionAnalytics, QuestionDistributionItem } from '@/lib/customQuestions';
import { CAMPAIGN_QUESTION_TYPE_LABEL, type CampaignQuestionType } from '@/types';

const SCALE_COLORS: Record<string, string> = {
  '5': '#22C55E',
  '4': '#A3E635',
  '3': '#F59E0B',
  '2': '#FB923C',
  '1': '#EF4444',
};

function colorFor(type: CampaignQuestionType, label: string): string {
  if (type === 'yes_no') {
    return label === 'Sim' ? '#22C55E' : label === 'Não' ? '#EF4444' : '#A78BFA';
  }
  if (type === 'scale_1_5') return SCALE_COLORS[label] ?? '#A78BFA';
  return '#A78BFA'; // single/multiple choice
}

// single/multiple → ordena por frequência (maior no topo). yes_no e scale_1_5
// já vêm em ordem semântica (Sim/Não, 5→1) da agregação.
function sortForType(
  type: CampaignQuestionType,
  dist: QuestionDistributionItem[],
): QuestionDistributionItem[] {
  if (type === 'single_choice' || type === 'multiple_choice') {
    return [...dist].sort((a, b) => b.count - a.count);
  }
  return dist;
}

export function CustomQuestionsAnalytics() {
  const { analytics, loading, totalAnswered } = useCustomQuestionsAnalytics();
  const session = useEffectiveSession();
  const isAdmin = session?.role === 'admin' || session?.is_super_admin === true;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  // Sem perguntas ativas cadastradas.
  if (analytics.length === 0) {
    return (
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-6 text-center">
        <ListChecks className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="font-medium text-foreground">Nenhuma pergunta regional cadastrada.</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Configure perguntas em Pesquisas → Perguntas Regionais.
        </p>
        {isAdmin ? (
          <Button asChild variant="outline" className="mt-4">
            <Link to="/pesquisas/perguntas-regionais">Configurar agora →</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  // Perguntas configuradas, mas ainda sem respostas.
  if (totalAnswered === 0) {
    return (
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-6 text-center">
        <p className="font-medium text-foreground">
          {analytics.length} pergunta{analytics.length === 1 ? '' : 's'} configurada
          {analytics.length === 1 ? '' : 's'}.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          As respostas aparecerão aqui após as primeiras entrevistas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg tracking-wide text-foreground">
          📍 Perguntas Regionais da Campanha
        </h3>
        <Badge variant="outline">
          {analytics.length} pergunta{analytics.length === 1 ? '' : 's'} · {totalAnswered}{' '}
          resposta{totalAnswered === 1 ? '' : 's'} coletada{totalAnswered === 1 ? '' : 's'}
        </Badge>
      </div>

      {analytics.map((a) => (
        <QuestionAnalyticsCard key={a.question.id} a={a} />
      ))}
    </div>
  );
}

function QuestionAnalyticsCard({ a }: { a: QuestionAnalytics }) {
  const { question, distribution, total, average } = a;
  const type = question.type;

  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
      <div className="mb-1 flex items-start justify-between gap-3">
        <p className="font-medium text-foreground">{question.text}</p>
        <Badge variant="outline" className="shrink-0">
          {CAMPAIGN_QUESTION_TYPE_LABEL[type]}
        </Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {total} resposta{total === 1 ? '' : 's'}
        {type === 'scale_1_5' && average != null ? ` · Média: ${average} / 5` : ''}
        {type === 'multiple_choice' ? ' · % sobre respondentes' : ''}
      </p>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Sem respostas ainda.</p>
      ) : type === 'free_text' ? (
        <ol className="space-y-1 text-sm">
          {distribution.map((d, i) => (
            <li key={d.label} className="flex items-center justify-between gap-2">
              <span className="truncate text-foreground/90">
                #{i + 1} {d.label}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {d.count} citações ({d.pct}%)
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="space-y-2">
          {sortForType(type, distribution).map((d) => (
            <Bar key={d.label} label={d.label} count={d.count} pct={d.pct} color={colorFor(type, d.label)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Bar({
  label,
  count,
  pct,
  color,
}: {
  label: string;
  count: number;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-foreground/90">{label}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {pct}% ({count})
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-vortex-bg/60">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
