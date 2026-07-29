// ============================================================================
// PorPesquisaTab — análise estatística de UM formulário de pesquisa (Fase 6).
// Seletor de formulário + amostra + demografia + gráfico por pergunta +
// cruzamento (pergunta × demografia). Aba dentro de Inteligência Eleitoral.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Sparkles, TrendingUp, TriangleAlert, Users } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
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
  cramersV,
  crossTab2,
  demoVariable,
  demographicsOf,
  isCorrelatable,
  questionVariable,
  sampleOf,
  strengthOf,
  topCorrelations,
  type CrossTab,
  type DemographicKey,
  type DistItem,
  type QuestionAgg,
  type StrengthLevel,
  type Variable,
} from '@/lib/surveyFormStats';
import { computeTrends, type Trend, type TrendTone } from '@/lib/surveyTrends';
import { CAMPAIGN_QUESTION_TYPE_LABEL, type CampaignQuestionType } from '@/types';

const CHOICE_COLORS = ['#A78BFA', '#22C55E', '#F59E0B', '#38BDF8', '#FB923C', '#EF4444', '#84CC16'];

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
  const trends = useMemo(
    () => computeTrends(orderedQuestions, responses),
    [orderedQuestions, responses],
  );

  // Correlações que se destacam (auto)
  const correlations = useMemo(
    () => topCorrelations(orderedQuestions, responses),
    [orderedQuestions, responses],
  );

  // Cruzamento (pergunta × demografia OU × outra pergunta)
  const crossable = useMemo(
    () => orderedQuestions.filter((q) => q.type !== 'free_text'),
    [orderedQuestions],
  );
  const [crossQid, setCrossQid] = useState('');
  const [crossBy, setCrossBy] = useState('demo:age');
  useEffect(() => {
    if (crossable.length > 0 && !crossable.find((q) => q.id === crossQid)) {
      setCrossQid(crossable[0].id);
    }
  }, [crossable, crossQid]);
  const crossQuestion = crossable.find((q) => q.id === crossQid);

  // Opções do "por": demografias + perguntas correlacionáveis (menos a analisada).
  const byOptions = useMemo(() => {
    const demos = [
      { value: 'demo:age', label: 'Faixa etária' },
      { value: 'demo:gender', label: 'Sexo' },
      { value: 'demo:religion', label: 'Religião' },
    ];
    const qs = orderedQuestions
      .filter((q) => isCorrelatable(q) && q.id !== crossQid)
      .map((q) => ({ value: `q:${q.id}`, label: q.text }));
    return [...demos, ...qs];
  }, [orderedQuestions, crossQid]);
  useEffect(() => {
    if (byOptions.length > 0 && !byOptions.find((o) => o.value === crossBy)) {
      setCrossBy(byOptions[0].value);
    }
  }, [byOptions, crossBy]);

  const groupByVar = useMemo<Variable | null>(() => {
    if (crossBy.startsWith('demo:')) return demoVariable(crossBy.slice(5) as DemographicKey);
    const q = orderedQuestions.find((x) => x.id === crossBy.slice(2));
    return q ? questionVariable(q) : null;
  }, [crossBy, orderedQuestions]);

  const cross = useMemo(
    () => (crossQuestion && groupByVar ? crossTab2(crossQuestion, groupByVar, responses) : null),
    [crossQuestion, groupByVar, responses],
  );
  const assoc = useMemo(
    () =>
      crossQuestion && groupByVar
        ? cramersV(questionVariable(crossQuestion), groupByVar, responses)
        : null,
    [crossQuestion, groupByVar, responses],
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

          {/* Tendências */}
          {trends.length > 0 ? (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-display text-lg tracking-wide text-foreground">
                <TrendingUp className="h-5 w-5 text-primary" /> Tendências
              </h3>
              <div className="grid gap-2 md:grid-cols-2">
                {trends.map((t, i) => (
                  <TrendCard key={i} trend={t} />
                ))}
              </div>
            </div>
          ) : null}

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

          {/* Correlações que se destacam */}
          {correlations.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-display text-lg tracking-wide text-foreground">
                Correlações que se destacam
              </h3>
              <div className="grid gap-2 md:grid-cols-2">
                {correlations.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-lg border border-vortex-border bg-vortex-surface/60 p-3 text-sm"
                  >
                    <span className="text-foreground/90">
                      <span className="font-medium">{shortLabel(c.a.label)}</span>
                      {' ↔ '}
                      <span className="font-medium">{shortLabel(c.b.label)}</span>
                      <span className="ml-1 text-xs text-muted-foreground">({c.n} resp.)</span>
                    </span>
                    <StrengthBadge v={c.v} />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Quanto mais forte a associação, mais as respostas “andam juntas” — indício de
                que uma percepção influencia a outra.
              </p>
            </div>
          ) : null}

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
                  <Select value={crossBy} onValueChange={setCrossBy}>
                    <SelectTrigger className="h-9 w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {byOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assoc && assoc.n > 0 ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      associação: <StrengthBadge v={assoc.v} />
                    </span>
                  ) : null}
                </div>
                <CrossTable cross={cross} type={crossQuestion?.type ?? 'single_choice'} />
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function shortLabel(s: string): string {
  return s.length > 42 ? `${s.slice(0, 42)}…` : s;
}

const STRENGTH_STYLE: Record<StrengthLevel, string> = {
  Fraca: 'bg-muted text-muted-foreground',
  Moderada: 'bg-amber-500/15 text-amber-300',
  Forte: 'bg-emerald-500/15 text-emerald-300',
  'Muito forte': 'bg-primary/20 text-primary',
};

function StrengthBadge({ v }: { v: number }) {
  const level = strengthOf(v);
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STRENGTH_STYLE[level]}`}
      title={`Cramér's V = ${v}`}
    >
      {level}
    </span>
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
      ) : type === 'yes_no' || type === 'single_choice' ? (
        <div className="grid gap-4 sm:grid-cols-[150px_1fr] sm:items-center">
          <Donut data={distribution} type={type} />
          <div className="space-y-2">
            {distribution.map((d, i) => (
              <Bar
                key={d.label}
                label={d.label}
                count={d.count}
                pct={d.pct}
                color={barColor(type, d.label, i)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {distribution.map((d, i) => (
            <Bar
              key={d.label}
              label={d.label}
              count={d.count}
              pct={d.pct}
              color={barColor(type, d.label, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function barColor(type: CampaignQuestionType, label: string, idx: number): string {
  if (type === 'yes_no') return colorFor(type, label);
  if (type === 'scale_1_5') return SCALE_COLORS[label] ?? '#A78BFA';
  return CHOICE_COLORS[idx % CHOICE_COLORS.length];
}

function Donut({ data, type }: { data: DistItem[]; type: CampaignQuestionType }) {
  const chartData = data.filter((d) => d.count > 0);
  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  }
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={36}
            outerRadius={62}
            paddingAngle={1}
          >
            {chartData.map((d, idx) => (
              <Cell
                key={d.label}
                fill={barColor(type, d.label, idx)}
                stroke="#0A0F1E"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, props) => [
              `${value} (${(props.payload as DistItem).pct}%)`,
              (props.payload as DistItem).label,
            ]}
            contentStyle={{
              backgroundColor: '#0F172A',
              border: '1px solid #334155',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

const TREND_STYLE: Record<TrendTone, string> = {
  positive: 'border-emerald-500/30 bg-emerald-500/5',
  negative: 'border-red-500/30 bg-red-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  neutral: 'border-vortex-border bg-vortex-surface/60',
};

function TrendCard({ trend }: { trend: Trend }) {
  const Icon =
    trend.tone === 'warning' ? TriangleAlert : trend.tone === 'neutral' ? Sparkles : TrendingUp;
  const iconColor =
    trend.tone === 'positive'
      ? 'text-emerald-400'
      : trend.tone === 'negative'
        ? 'text-red-400'
        : trend.tone === 'warning'
          ? 'text-amber-400'
          : 'text-primary';
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${TREND_STYLE[trend.tone]}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
      <span className="text-foreground/90">{trend.text}</span>
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

function CrossTable({ cross, type }: { cross: CrossTab; type: CampaignQuestionType }) {
  if (cross.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados pra cruzar.</p>;
  }
  return (
    <div className="overflow-x-auto">
      {/* max-w evita a tabela esticar/espalhar em tela larga */}
      <table className="w-full min-w-[520px] max-w-3xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-vortex-border text-left text-xs uppercase tracking-widest text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Grupo</th>
            {cross.columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-medium">
                {c}
              </th>
            ))}
            <th className="py-2 pl-3 text-right font-medium">n</th>
          </tr>
        </thead>
        <tbody>
          {cross.rows.map((row) => (
            <tr key={row.group} className="border-b border-vortex-border/40">
              <td className="whitespace-nowrap py-2 pr-4 text-foreground">{row.group}</td>
              {row.cells.map((cell, i) => (
                <td key={cell.label} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-vortex-bg/60">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${cell.pct}%`,
                          backgroundColor: barColor(type, cell.label, i),
                        }}
                      />
                    </div>
                    <span
                      className={
                        cell.pct >= 50
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground'
                      }
                    >
                      {cell.pct}%
                    </span>
                  </div>
                </td>
              ))}
              <td className="py-2 pl-3 text-right font-mono text-xs text-muted-foreground">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
