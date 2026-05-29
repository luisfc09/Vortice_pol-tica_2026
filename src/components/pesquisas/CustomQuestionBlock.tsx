import { Check } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  answerHasValue,
  type CustomAnswersState,
  type CustomAnswerValue,
} from '@/lib/customQuestions';
import type { CampaignQuestion } from '@/types';

interface Props {
  questions: CampaignQuestion[];
  answers: CustomAnswersState;
  onChange: (questionId: string, value: CustomAnswerValue) => void;
  /** IDs de perguntas obrigatórias não respondidas (após tentar finalizar). */
  errorIds: string[];
}

// Bloco 6 — perguntas regionais da campanha. Mobile-first: alvos de toque
// grandes (o entrevistador usa celular em campo).
export function CustomQuestionBlock({ questions, answers, onChange, errorIds }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Bloco 6</p>
        <h3 className="font-display text-xl tracking-wide text-foreground">
          📍 Perguntas da Campanha
        </h3>
        <p className="text-sm text-muted-foreground">
          {questions.length} pergunta{questions.length === 1 ? '' : 's'} — específicas desta
          campanha
        </p>
      </div>

      {questions.map((q, i) => {
        const a = answers[q.id];
        const hasError = errorIds.includes(q.id) && !answerHasValue(a);
        return (
          <div
            key={q.id}
            id={`custom-q-${q.id}`}
            className={cn(
              'rounded-xl border p-3 transition-colors',
              hasError ? 'border-red-500 bg-red-500/5' : 'border-vortex-border bg-vortex-bg/20',
            )}
          >
            <p className="mb-3 font-medium text-foreground">
              {i + 1}. {q.text}
              {q.is_required ? <span className="ml-1 text-red-400">*</span> : null}
            </p>

            <QuestionInput question={q} value={a} onChange={(v) => onChange(q.id, v)} />

            {hasError ? (
              <p className="mt-2 text-xs font-medium text-red-400">Esta pergunta é obrigatória</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: CampaignQuestion;
  value: CustomAnswerValue | undefined;
  onChange: (v: CustomAnswerValue) => void;
}) {
  const opts = Array.isArray(question.options) ? question.options : [];

  if (question.type === 'yes_no') {
    const v = value?.optionValue ?? null;
    return (
      <div className="grid grid-cols-2 gap-3">
        {(['Sim', 'Não'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange({ type: 'yes_no', optionValue: opt })}
            className={cn(
              'flex h-14 items-center justify-center gap-2 rounded-xl border text-base font-semibold transition-colors',
              v === opt
                ? 'border-primary bg-primary/15 text-foreground'
                : 'border-vortex-border bg-vortex-surface/40 text-muted-foreground hover:border-primary/40',
            )}
          >
            {opt === 'Sim' ? '✅' : '❌'} {opt}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'scale_1_5') {
    const v = value?.scaleValue ?? null;
    return (
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange({ type: 'scale_1_5', scaleValue: n })}
            className={cn(
              'flex h-14 items-center justify-center rounded-xl border text-lg font-bold transition-colors',
              v === n
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-vortex-border bg-vortex-surface/40 text-muted-foreground hover:border-primary/40',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'single_choice') {
    const v = value?.optionValue ?? null;
    return (
      <div className="space-y-2">
        {opts.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange({ type: 'single_choice', optionValue: opt })}
            className={cn(
              'flex w-full items-center rounded-xl border px-4 py-3 text-left text-base transition-colors',
              v === opt
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-vortex-border bg-vortex-surface/40 text-muted-foreground hover:border-primary/40',
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'multiple_choice') {
    const vals = value?.optionValues ?? [];
    const toggle = (opt: string) => {
      const next = vals.includes(opt) ? vals.filter((x) => x !== opt) : [...vals, opt];
      onChange({ type: 'multiple_choice', optionValues: next });
    };
    return (
      <div className="space-y-2">
        {opts.map((opt) => {
          const sel = vals.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base transition-colors',
                sel
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-vortex-border bg-vortex-surface/40 text-muted-foreground hover:border-primary/40',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                  sel
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground',
                )}
              >
                {sel ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  // free_text
  return (
    <Textarea
      rows={3}
      placeholder="Digite sua resposta..."
      value={value?.textValue ?? ''}
      onChange={(e) => onChange({ type: 'free_text', textValue: e.target.value })}
    />
  );
}
