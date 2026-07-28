// ============================================================================
// FormularioRespostasPage — repositório de respostas de um Formulário de
// Pesquisa (Fase 4). Reúne presencial + público, filtra por canal, mostra
// demografia + respostas, e exporta CSV. (migration 052/053)
// ============================================================================

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Inbox, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/data/EmptyState';
import { useSurveyFormDetail } from '@/hooks/useSurveyForms';
import { useSurveyResponses } from '@/hooks/useSurveyResponses';
import {
  AGE_RANGE_LABEL,
  GENDER_LABEL,
  RELIGION_LABEL,
  SURVEY_CHANNEL_LABEL,
  type SurveyChannel,
  type SurveyFormQuestion,
  type SurveyResponse,
} from '@/types';

type ChannelFilter = 'todos' | SurveyChannel;

export default function FormularioRespostasPage() {
  const { id } = useParams<{ id: string }>();
  const { form, questions } = useSurveyFormDetail(id);
  const { responses, interviewerNames, loading } = useSurveyResponses(id);

  const [filter, setFilter] = useState<ChannelFilter>('todos');

  const counts = useMemo(() => {
    const presencial = responses.filter((r) => r.channel === 'presencial').length;
    const publico = responses.filter((r) => r.channel === 'publico').length;
    return { total: responses.length, presencial, publico };
  }, [responses]);

  const filtered = useMemo(
    () => (filter === 'todos' ? responses : responses.filter((r) => r.channel === filter)),
    [responses, filter],
  );

  const orderedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.position - b.position),
    [questions],
  );

  function exportCsv() {
    if (!form) return;
    const csv = buildCsv(filtered, orderedQuestions, interviewerNames);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = form.name.replace(/[^\w-]+/g, '_').slice(0, 40);
    a.download = `respostas_${safeName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to={id ? `/pesquisas/formularios/${id}` : '/pesquisas/formularios'}>
          <ArrowLeft className="h-4 w-4" /> Voltar ao formulário
        </Link>
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary">Repositório</p>
          <h2 className="font-display text-2xl tracking-wide text-foreground">
            {form?.name ?? 'Respostas'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.total} resposta{counts.total === 1 ? '' : 's'} · {counts.presencial} presencial ·{' '}
            {counts.publico} público
          </p>
        </div>
        <Button onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* Filtro por canal */}
      <div className="flex flex-wrap gap-2">
        {(['todos', 'presencial', 'publico'] as ChannelFilter[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              filter === c
                ? 'border-primary bg-primary/15 text-foreground'
                : 'border-border/40 text-muted-foreground hover:border-border'
            }`}
          >
            {c === 'todos'
              ? `Todos · ${counts.total}`
              : `${SURVEY_CHANNEL_LABEL[c]} · ${c === 'presencial' ? counts.presencial : counts.publico}`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="Nenhuma resposta ainda."
          description="As respostas aplicadas em campo e as recebidas pelo link aparecem aqui."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ResponseCard
              key={r.id}
              response={r}
              questions={orderedQuestions}
              interviewerName={r.interviewer_id ? interviewerNames[r.interviewer_id] : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResponseCard({
  response: r,
  questions,
  interviewerName,
}: {
  response: SurveyResponse;
  questions: SurveyFormQuestion[];
  interviewerName?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 py-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-foreground">{r.respondent_name || 'Anônimo'}</p>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                r.channel === 'presencial'
                  ? 'bg-primary/15 text-primary'
                  : 'bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {SURVEY_CHANNEL_LABEL[r.channel]}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(r.submitted_at).toLocaleString('pt-BR')}
            </span>
          </div>
        </div>

        {/* Demografia */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {r.age_range ? <span>{AGE_RANGE_LABEL[r.age_range]}</span> : null}
          {r.gender ? <span>· {GENDER_LABEL[r.gender]}</span> : null}
          {r.religion ? <span>· {RELIGION_LABEL[r.religion]}</span> : null}
          {r.respondent_phone ? <span>· {r.respondent_phone}</span> : null}
          {r.neighborhood || r.municipality_code ? (
            <span className="flex items-center gap-1">
              · <MapPin className="h-3 w-3" />
              {[r.neighborhood, r.municipality_code].filter(Boolean).join(' / ')}
            </span>
          ) : null}
          {interviewerName ? (
            <span className="flex items-center gap-1">
              · <Users className="h-3 w-3" /> {interviewerName}
            </span>
          ) : null}
        </div>

        {/* Respostas */}
        {questions.length > 0 ? (
          <div className="mt-1 space-y-1 border-t border-border/30 pt-2">
            {questions.map((q) => {
              const val = r.answers?.[q.id];
              return (
                <div key={q.id} className="text-xs">
                  <span className="text-muted-foreground">{q.text}: </span>
                  <span className="text-foreground">{formatAnswer(val)}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatAnswer(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

// ---------------------------------------------------------------------------
// CSV — 1 linha por resposta; colunas fixas + 1 por pergunta.
// ---------------------------------------------------------------------------
function buildCsv(
  rows: SurveyResponse[],
  questions: SurveyFormQuestion[],
  interviewerNames: Record<string, string>,
): string {
  const headers = [
    'Data',
    'Canal',
    'Entrevistador',
    'Nome',
    'Faixa etária',
    'Sexo',
    'Religião',
    'Telefone',
    'Município',
    'Bairro',
    ...questions.map((q) => q.text),
  ];
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) {
    const cells = [
      new Date(r.submitted_at).toLocaleString('pt-BR'),
      SURVEY_CHANNEL_LABEL[r.channel],
      r.interviewer_id ? interviewerNames[r.interviewer_id] ?? '' : '',
      r.respondent_name ?? '',
      r.age_range ? AGE_RANGE_LABEL[r.age_range] : '',
      r.gender ? GENDER_LABEL[r.gender] : '',
      r.religion ? RELIGION_LABEL[r.religion] : '',
      r.respondent_phone ?? '',
      r.municipality_code ?? '',
      r.neighborhood ?? '',
      ...questions.map((q) => formatAnswer(r.answers?.[q.id])),
    ];
    lines.push(cells.map(csvCell).join(','));
  }
  return lines.join('\n');
}

function csvCell(v: string): string {
  const s = v ?? '';
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
