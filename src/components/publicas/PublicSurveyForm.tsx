// ============================================================================
// PublicSurveyForm — renderiza o formulário público (rota /p/:token).
// Suporta os 5 tipos de CampaignQuestion: yes_no, single_choice,
// multiple_choice, scale_1_5, free_text. Validação: obrigatórias vazias
// bloqueiam submit.
// ============================================================================

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import type { PublicSurveyPublicView, PublicSurveyQuestion } from '@/types';

type Answer = string | string[] | number | boolean | null;
type AnswersState = Record<string, Answer>;

interface Props {
  survey: PublicSurveyPublicView;
  submitting: boolean;
  onSubmit: (payload: {
    answers: AnswersState;
    name: string;
    phone: string;
    municipality: string;
    neighborhood: string;
  }) => void;
}

export function PublicSurveyForm({ survey, submitting, onSubmit }: Props) {
  const [answers, setAnswers] = useState<AnswersState>({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const requiredMissing = useMemo(() => {
    return survey.questions.filter((q) => q.is_required && isEmpty(answers[q.id]));
  }, [survey.questions, answers]);

  function setAnswer(qid: string, value: Answer) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requiredMissing.length > 0) {
      setValidationError(
        `Faltou responder ${requiredMissing.length} pergunta${
          requiredMissing.length === 1 ? ' obrigatória' : 's obrigatórias'
        }.`,
      );
      return;
    }
    setValidationError(null);
    onSubmit({ answers, name, phone, municipality, neighborhood });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cabeçalho de identificação (opcional) */}
      {(survey.ask_name || survey.ask_phone || survey.ask_location) && (
        <div className="space-y-4 rounded-lg border border-border/40 bg-card/40 p-4">
          <p className="text-sm text-muted-foreground">
            Se quiser, se identifique (opcional):
          </p>
          {survey.ask_name && (
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Seu nome</Label>
              <Input
                id="p-name"
                placeholder="Como você prefere ser chamado(a)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}
          {survey.ask_phone && (
            <div className="space-y-1.5">
              <Label htmlFor="p-phone">WhatsApp / telefone</Label>
              <Input
                id="p-phone"
                type="tel"
                placeholder="(00) 90000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
          )}
          {survey.ask_location && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-city">Município</Label>
                <Input
                  id="p-city"
                  placeholder="Ex: Belo Horizonte"
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-neigh">Bairro</Label>
                <Input
                  id="p-neigh"
                  placeholder="Ex: Centro"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Perguntas */}
      <div className="space-y-5">
        {survey.questions.map((q, i) => (
          <QuestionField
            key={q.id}
            index={i + 1}
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswer(q.id, v)}
          />
        ))}
      </div>

      {validationError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
          {validationError}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? 'Enviando…' : 'Enviar resposta'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Um campo por pergunta (dispatch por tipo)
// ---------------------------------------------------------------------------
interface FieldProps {
  index: number;
  question: PublicSurveyQuestion;
  value: Answer;
  onChange: (v: Answer) => void;
}

function QuestionField({ index, question, value, onChange }: FieldProps) {
  const label = (
    <div className="flex items-baseline gap-2">
      <span className="text-xs font-semibold text-muted-foreground">{index}.</span>
      <span className="text-foreground">
        {question.label}
        {question.is_required && <span className="ml-1 text-primary">*</span>}
      </span>
    </div>
  );

  return (
    <div className="space-y-2">
      {label}
      <div className="pl-6">
        {question.type === 'free_text' && (
          <Textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Sua resposta"
          />
        )}

        {question.type === 'yes_no' && (
          <div className="flex gap-2">
            {['Sim', 'Não'].map((opt) => (
              <Button
                key={opt}
                type="button"
                variant={value === opt ? 'default' : 'secondary'}
                onClick={() => onChange(opt)}
                className="flex-1"
              >
                {opt}
              </Button>
            ))}
          </div>
        )}

        {question.type === 'single_choice' && (
          <div className="space-y-2">
            {(question.options ?? []).map((opt) => (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm transition-colors ${
                  value === opt
                    ? 'border-primary/60 bg-primary/10'
                    : 'border-border/40 hover:border-border'
                }`}
              >
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  className="h-4 w-4 accent-primary"
                />
                {opt}
              </label>
            ))}
          </div>
        )}

        {question.type === 'multiple_choice' && (
          <div className="space-y-2">
            {(question.options ?? []).map((opt) => {
              const arr = Array.isArray(value) ? value : [];
              const checked = arr.includes(opt);
              return (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm transition-colors ${
                    checked
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-border/40 hover:border-border'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => {
                      if (next === true) onChange([...arr, opt]);
                      else onChange(arr.filter((v) => v !== opt));
                    }}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        )}

        {question.type === 'scale_1_5' && (
          <div className="space-y-3">
            <Slider
              min={1}
              max={5}
              step={1}
              value={[typeof value === 'number' ? value : 3]}
              onValueChange={(vals) => onChange(vals[0] ?? 3)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 (péssimo)</span>
              <span className="font-medium text-foreground">
                {typeof value === 'number' ? value : '—'}
              </span>
              <span>5 (ótimo)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function isEmpty(v: Answer): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}
