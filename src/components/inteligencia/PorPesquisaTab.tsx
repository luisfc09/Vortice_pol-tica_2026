// ============================================================================
// PorPesquisaTab — análise estatística de UM formulário de pesquisa (Fase 6).
// Seletor de formulário + amostra + demografia + gráfico por pergunta +
// cruzamento (pergunta × demografia). Aba dentro de Inteligência Eleitoral.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Users } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useSurveyForms, useSurveyFormDetail } from '@/hooks/useSurveyForms';
import { useSurveyResponses } from '@/hooks/useSurveyResponses';
import {
  aggregateQuestion,
  crossTabOf,
  demographicsOf,
  sampleOf,
  DEMOGRAPHIC_LABEL,
  type DemographicKey,
  type DistItem,
  type QuestionAgg,
} from '@/lib/surveyFormStats';
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
  return '#A78BFA';
}

export function PorPesquisaTab() {
  const { forms, loading: formsLoading } = useSurveyForms();
  const [formId, setFormId] = useState('');

  useEffect(() => {
    if (!formId && forms.length > 0) setFormId(forms[0].id);
  }, [forms, formId]);

  const { questions } = useSurveyFormDetail(formId || undefined);
  const { responses, loading: respLoading } = useSurveyResponses(formId || undefined);

  const orderedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.position - b.position),
    [questions],
  );
  const sample = useMemo(() => sampleOf(responses), [responses]);
  const demo = useMemo(() => demographicsOf(responses), [responses]);
  const aggs = useMemo(
    () => orderedQuestions.map((q) => aggregateQuestion(q, responses)),
    [orderedQuestions, responses],
  );

  // Cruzamento
  const crossable = useMemo(
    () => orderedQuestions.filter((q) => q.type !== 'free_text'),
    [orderedQuestions],
  );
  const [crossQid, setCrossQid] = useState('');
  const [crossDemo, setCrossDemo] = useState<DemographicKey>('age');
  useEffect(() => {
    if (crossable.length > 0 && !crossable.find((q) => q.id === crossQid)) {
      setCrossQid(crossable[0].id);
    }
  }, [crossable, crossQid]);
  const crossQuestion = crossable.find((q) => q.id === crossQid);
  const cross = useMemo(
    () => (crossQuestion ? crossTabOf(crossQuestion, responses, crossDemo) : null),
    [crossQuestion, responses, crossDemo],
  );

  if (formsLoading) {
    return <p className="text-sm text-muted-foreground">Carregando formulários…</p>;
  }
  if (forms.length === 0) {
    return (
      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-6 text-center">
        <BarChart3 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="font-medium text-foreground">Nenhum formulário de pesquisa ainda.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie um em Pesquisas → Formulários de Pesquisa e colete respostas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seletor de formulário */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Analisar pesquisa:</span>
        <Select value={formId} onValueChange={setFormId}>
          <SelectTrigger className="h-9 w-72">
            <SelectValue placeholder="Escolha um formulário" />
          </SelectTrigger>
          <SelectContent>
            {forms.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name} ({f.response_count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {respLoading ? (
        <p className="text-sm text-muted-foreground">Carregando respostas…</p>
      ) : sample.total === 0 ? (
        <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-6 text-center">
          <p className="font-medium text-foreground">Sem respostas ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            As análises aparecem aqui assim que a pesquisa receber respostas (presencial ou
            link).
          </p>
        </div>
      ) : (
        <>
          {/* Amostra */}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Respostas" value={sample.total} icon />
            <StatTile label="Presencial" value={sample.presencial} />
            <StatTile label="Link público" value={sample.publico} />
          </div>

          {/* Demografia */}
          <div className="grid gap-3 md:grid-cols-3">
            <DistCard title="Faixa etária" items={demo.age} />
            <DistCard title="Sexo" items={demo.gender} />
            <DistCard title="Religião" items={demo.religion} />
          </div>

          {/* Perguntas */}
          <div className="space-y-3">
            <h3 className="font-display text-lg tracking-wide text-foreground">
              Respostas por pergunta
            </h3>
            {aggs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este formulário não tem perguntas.
              </p>
            ) : (
              aggs.map((a) => <QuestionCard key={a.question.id} a={a} />)
            )}
          </div>

          {/* Cruzamento */}
          {crossable.length > 0 && cross ? (
            <div className="space-y-3">
              <h3 className="font-display text-lg tracking-wide text-foreground">
                Cruzamento estratégico
              </h3>
              <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <Select value={crossQid} onValueChange={setCrossQid}>
                    <SelectTrigger className="h-9 w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {crossable.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.text}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">por</span>
                  <Select
                    value={crossDemo}
                    onValueChange={(v) => setCrossDemo(v as DemographicKey)}
                  >
                    <SelectTrigger className="h-9 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['age', 'gender', 'religion'] as DemographicKey[]).map((d) => (
                        <SelectItem key={d} value={d}>
                          {DEMOGRAPHIC_LABEL[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CrossTable cross={cross} />
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, icon }: { label: string; value: number; icon?: boolean }) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon ? <Users className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <p className="mt-1 font-display text-3xl text-foreground">{value}</p>
    </div>
  );
}

function DistCard({ title, items }: { title: string; items: DistItem[] }) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4">
      <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados.</p>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <Bar key={d.label} label={d.label} count={d.count} pct={d.pct} color="#A78BFA" />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({ a }: { a: QuestionAgg }) {
  const { question, type, distribution, total, average, texts } = a;
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
        <ol className="max-h-64 space-y-1 overflow-y-auto pr-1 text-sm">
          {(texts ?? []).map((t, i) => (
            <li key={i} className="rounded-md bg-vortex-bg/40 px-2 py-1 text-foreground/90">
              {t}
            </li>
          ))}
        </ol>
      ) : (
        <div className="space-y-2">
          {distribution.map((d) => (
            <Bar
              key={d.label}
              label={d.label}
              count={d.count}
              pct={d.pct}
              color={colorFor(type, d.label)}
            />
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

function CrossTable({ cross }: { cross: ReturnType<typeof crossTabOf> }) {
  if (cross.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados pra cruzar.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-vortex-border text-left text-xs uppercase tracking-widest text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Grupo</th>
            {cross.columns.map((c) => (
              <th key={c} className="px-2 py-2 text-center font-medium">
                {c}
              </th>
            ))}
            <th className="py-2 pl-2 text-right font-medium">n</th>
          </tr>
        </thead>
        <tbody>
          {cross.rows.map((row) => (
            <tr key={row.group} className="border-b border-vortex-border/40">
              <td className="py-2 pr-3 text-foreground">{row.group}</td>
              {row.cells.map((cell) => (
                <td key={cell.label} className="px-2 py-2 text-center">
                  <span
                    className={
                      cell.pct >= 50
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    {cell.pct}%
                  </span>
                </td>
              ))}
              <td className="py-2 pl-2 text-right font-mono text-xs text-muted-foreground">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
