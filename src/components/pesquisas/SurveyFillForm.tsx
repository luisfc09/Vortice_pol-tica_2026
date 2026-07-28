// ============================================================================
// SurveyFillForm — preenchimento de um Formulário de Pesquisa presencial
// (migration 052, Fase 2). Demografia fixa (nome/faixa/sexo/religião) +
// opcionais (telefone/município/bairro) + perguntas (5 tipos).
// Reutilizável; o container decide o que fazer no submit.
// ============================================================================

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { MunicipalityCombobox } from '@/components/ui/municipality-combobox';
import {
  AGE_RANGE_LABEL,
  GENDER_LABEL,
  RELIGION_LABEL,
  type AgeRange,
  type Gender,
  type Religion,
  type SurveyFormQuestion,
} from '@/types';

type Answer = string | string[] | number | null;
type AnswersState = Record<string, Answer>;

export interface FillPayload {
  respondent_name: string;
  age_range: AgeRange | null;
  gender: Gender | null;
  religion: Religion | null;
  respondent_phone: string;
  municipality_code: string;
  neighborhood: string;
  answers: AnswersState;
}

// Shapes leves — servem tanto pro SurveyForm completo (presencial) quanto pra
// view pública (get_survey_form_by_token).
export interface FillFormConfig {
  collect_phone: boolean;
  collect_municipality: boolean;
  collect_neighborhood: boolean;
}
export type FillQuestion = Pick<
  SurveyFormQuestion,
  'id' | 'text' | 'type' | 'options' | 'is_required' | 'position'
>;

interface Props {
  form: FillFormConfig;
  questions: FillQuestion[];
  submitting: boolean;
  onSubmit: (payload: FillPayload) => void;
}

export function SurveyFillForm({ form, questions, submitting, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [religion, setReligion] = useState<Religion | null>(null);
  const [phone, setPhone] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [answers, setAnswers] = useState<AnswersState>({});
  const [error, setError] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...questions].sort((a, b) => a.position - b.position),
    [questions],
  );

  function setAnswer(qid: string, v: Answer) {
    setAnswers((prev) => ({ ...prev, [qid]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validação: nome + demografia fixa obrigatórios.
    if (name.trim().length < 2) return setError('Informe o nome do eleitor.');
    if (!ageRange) return setError('Selecione a faixa etária.');
    if (!gender) return setError('Selecione o sexo.');
    if (!religion) return setError('Selecione a religião.');
    // Perguntas obrigatórias.
    const missing = ordered.filter((q) => q.is_required && isEmpty(answers[q.id]));
    if (missing.length > 0) {
      return setError(
        `Faltou responder ${missing.length} pergunta${missing.length === 1 ? ' obrigatória' : 's obrigatórias'}.`,
      );
    }
    setError(null);
    onSubmit({
      respondent_name: name.trim(),
      age_range: ageRange,
      gender,
      religion,
      respondent_phone: phone.trim(),
      municipality_code: municipality,
      neighborhood: neighborhood.trim(),
      answers,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Demografia */}
      <div className="space-y-4 rounded-lg border border-border/40 bg-card/40 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="s-name">Nome do eleitor *</Label>
          <Input
            id="s-name"
            placeholder="Como o eleitor se apresentou"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <PillGroup
          label="Faixa etária *"
          options={Object.keys(AGE_RANGE_LABEL) as AgeRange[]}
          selected={ageRange}
          getLabel={(v) => AGE_RANGE_LABEL[v]}
          onSelect={setAgeRange}
        />
        <PillGroup
          label="Sexo *"
          options={Object.keys(GENDER_LABEL) as Gender[]}
          selected={gender}
          getLabel={(v) => GENDER_LABEL[v]}
          onSelect={setGender}
        />
        <PillGroup
          label="Religião *"
          options={Object.keys(RELIGION_LABEL) as Religion[]}
          selected={religion}
          getLabel={(v) => RELIGION_LABEL[v]}
          onSelect={setReligion}
        />

        {form.collect_phone && (
          <div className="space-y-1.5">
            <Label htmlFor="s-phone">Telefone / WhatsApp</Label>
            <Input
              id="s-phone"
              type="tel"
              placeholder="(00) 90000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        )}
        {form.collect_municipality && (
          <div className="space-y-1.5">
            <Label>Município</Label>
            <MunicipalityCombobox
              value={municipality}
              onChange={(code) => setMunicipality(code)}
            />
          </div>
        )}
        {form.collect_neighborhood && (
          <div className="space-y-1.5">
            <Label htmlFor="s-neigh">Bairro</Label>
            <Input
              id="s-neigh"
              placeholder="Ex: Centro"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Perguntas */}
      {ordered.length > 0 && (
        <div className="space-y-5">
          {ordered.map((q, i) => (
            <QuestionField
              key={q.id}
              index={i + 1}
              question={q}
              value={answers[q.id]}
              onChange={(v) => setAnswer(q.id, v)}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? 'Salvando…' : 'Salvar resposta'}
      </Button>
    </form>
  );
}

function PillGroup<T extends string>({
  label,
  options,
  selected,
  getLabel,
  onSelect,
}: {
  label: string;
  options: T[];
  selected: T | null;
  getLabel: (v: T) => string;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              selected === opt
                ? 'border-primary bg-primary/15 text-foreground'
                : 'border-border/40 text-muted-foreground hover:border-border'
            }`}
          >
            {getLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionField({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: FillQuestion;
  value: Answer;
  onChange: (v: Answer) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{index}.</span>
        <span className="text-foreground">
          {question.text}
          {question.is_required && <span className="ml-1 text-primary">*</span>}
        </span>
      </div>
      <div className="pl-6">
        {question.type === 'free_text' && (
          <Textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Resposta"
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
                  value === opt ? 'border-primary/60 bg-primary/10' : 'border-border/40'
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
                    checked ? 'border-primary/60 bg-primary/10' : 'border-border/40'
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
              <span>1</span>
              <span className="font-medium text-foreground">
                {typeof value === 'number' ? value : '—'}
              </span>
              <span>5</span>
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
