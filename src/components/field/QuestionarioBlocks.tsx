// Blocos do questionário aprofundado de campo. Cada bloco renderiza
// um conjunto de perguntas que escreve numa parcela do FieldInterview.
// As perguntas seguem boa prática de pesquisa eleitoral: fechadas
// primeiro, abertas no fim.

import { Star } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  AGE_RANGE_LABEL,
  CANDIDATE_AWARENESS_LABEL,
  CANDIDATE_OPINION_LABEL,
  CITY_PROBLEM_LABEL,
  COUNTRY_DIRECTION_LABEL,
  EDUCATION_LABEL,
  GENDER_LABEL,
  GOV_RATING_LABEL,
  INCOME_LABEL,
  PRIORITY_THEMES,
  RELIGION_LABEL,
  VOTE_DECISION_LABEL,
  WORK_STATUS_LABEL,
  type AgeRange,
  type CandidateAwareness,
  type CandidateOpinion,
  type CityProblem,
  type CountryDirection,
  type Education,
  type Gender,
  type GovRating,
  type IncomeRange,
  type Religion,
  type VoteDecision,
  type WorkStatus,
} from '@/types';

// --------------------------------------------------------------------------
// Tipo de estado compartilhado entre todos os blocos.
// --------------------------------------------------------------------------
export interface QuestionarioState {
  // Bloco 1
  age_range: AgeRange | null;
  gender: Gender | null;
  education: Education | null;
  income_range: IncomeRange | null;
  work_status: WorkStatus | null;
  religion: Religion | null;
  // Bloco 2
  vote_decision: VoteDecision | null;
  candidate_awareness: CandidateAwareness | null;
  candidate_opinion: CandidateOpinion | null;
  conversion_argument: string | null;
  // Bloco 3
  main_city_problem: CityProblem | null;
  important_themes: string[];
  health_rating: number | null;
  security_rating: number | null;
  employment_rating: number | null;
  neighborhood_complaint: string | null;
  // Bloco 4
  state_gov_rating: GovRating | null;
  federal_gov_rating: GovRating | null;
  city_gov_rating: GovRating | null;
  country_direction: CountryDirection | null;
  // Bloco 5
  notes_extra: string | null; // observações do entrevistador (separado de form.notes)
  receptivity_field: number; // 1-5
  is_potential_leader: boolean;
  accepted_contact: boolean;
}

export const EMPTY_QUESTIONARIO: QuestionarioState = {
  age_range: null,
  gender: null,
  education: null,
  income_range: null,
  work_status: null,
  religion: null,
  vote_decision: null,
  candidate_awareness: null,
  candidate_opinion: null,
  conversion_argument: null,
  main_city_problem: null,
  important_themes: [],
  health_rating: null,
  security_rating: null,
  employment_rating: null,
  neighborhood_complaint: null,
  state_gov_rating: null,
  federal_gov_rating: null,
  city_gov_rating: null,
  country_direction: null,
  notes_extra: null,
  receptivity_field: 3,
  is_potential_leader: false,
  accepted_contact: false,
};

interface BlockProps {
  value: QuestionarioState;
  onChange: (next: Partial<QuestionarioState>) => void;
}

// --------------------------------------------------------------------------
// Helper visual: grupo de botões "pill" para enum fechado.
// --------------------------------------------------------------------------
function PillGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            type="button"
            key={o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-vortex-border bg-vortex-surface/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// Estrelas 1-5 (clicáveis)
// --------------------------------------------------------------------------
function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value != null && n <= value;
        return (
          <button
            type="button"
            key={n}
            onClick={() => onChange(n)}
            aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                'h-5 w-5',
                filled ? 'fill-vortex-lime text-vortex-lime' : 'text-muted-foreground',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// BLOCO 1 — Perfil
// --------------------------------------------------------------------------
export function PerfilBlock({ value, onChange }: BlockProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Faixa etária</Label>
        <PillGroup<AgeRange>
          value={value.age_range}
          onChange={(v) => onChange({ age_range: v })}
          options={(Object.keys(AGE_RANGE_LABEL) as AgeRange[]).map((v) => ({
            v,
            label: AGE_RANGE_LABEL[v],
          }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Gênero</Label>
        <PillGroup<Gender>
          value={value.gender}
          onChange={(v) => onChange({ gender: v })}
          options={(Object.keys(GENDER_LABEL) as Gender[]).map((v) => ({
            v,
            label: GENDER_LABEL[v],
          }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Escolaridade</Label>
          <Select
            value={value.education ?? ''}
            onValueChange={(v) => onChange({ education: v as Education })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EDUCATION_LABEL) as Education[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {EDUCATION_LABEL[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Renda familiar</Label>
          <Select
            value={value.income_range ?? ''}
            onValueChange={(v) => onChange({ income_range: v as IncomeRange })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(INCOME_LABEL) as IncomeRange[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {INCOME_LABEL[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Situação</Label>
          <Select
            value={value.work_status ?? ''}
            onValueChange={(v) => onChange({ work_status: v as WorkStatus })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(WORK_STATUS_LABEL) as WorkStatus[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {WORK_STATUS_LABEL[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Religião</Label>
          <Select
            value={value.religion ?? ''}
            onValueChange={(v) => onChange({ religion: v as Religion })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RELIGION_LABEL) as Religion[]).map((v) => (
                <SelectItem key={v} value={v}>
                  {RELIGION_LABEL[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// BLOCO 2 — Cenário Eleitoral
// --------------------------------------------------------------------------
export function CenarioBlock({ value, onChange }: BlockProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Já decidiu o voto?</Label>
        <PillGroup<VoteDecision>
          value={value.vote_decision}
          onChange={(v) => onChange({ vote_decision: v })}
          options={(Object.keys(VOTE_DECISION_LABEL) as VoteDecision[]).map((v) => ({
            v,
            label: VOTE_DECISION_LABEL[v],
          }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Conhece o candidato?</Label>
        <PillGroup<CandidateAwareness>
          value={value.candidate_awareness}
          onChange={(v) => onChange({ candidate_awareness: v })}
          options={(Object.keys(CANDIDATE_AWARENESS_LABEL) as CandidateAwareness[]).map(
            (v) => ({ v, label: CANDIDATE_AWARENESS_LABEL[v] }),
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>Opinião sobre o candidato</Label>
        <PillGroup<CandidateOpinion>
          value={value.candidate_opinion}
          onChange={(v) => onChange({ candidate_opinion: v })}
          options={(Object.keys(CANDIDATE_OPINION_LABEL) as CandidateOpinion[]).map(
            (v) => ({ v, label: CANDIDATE_OPINION_LABEL[v] }),
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="conversion_argument">O que poderia convencê-lo? (opcional)</Label>
        <Textarea
          id="conversion_argument"
          rows={3}
          value={value.conversion_argument ?? ''}
          onChange={(e) => onChange({ conversion_argument: e.target.value })}
          placeholder="Pauta, proposta, gesto…"
        />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// BLOCO 3 — Temas e Prioridades
// --------------------------------------------------------------------------
const MAX_THEMES = 3;

export function TemasBlock({ value, onChange }: BlockProps) {
  function toggleTheme(t: string) {
    const set = new Set(value.important_themes);
    if (set.has(t)) set.delete(t);
    else if (set.size < MAX_THEMES) set.add(t);
    onChange({ important_themes: [...set] });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Maior problema da cidade</Label>
        <Select
          value={value.main_city_problem ?? ''}
          onValueChange={(v) => onChange({ main_city_problem: v as CityProblem })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CITY_PROBLEM_LABEL) as CityProblem[]).map((v) => (
              <SelectItem key={v} value={v}>
                {CITY_PROBLEM_LABEL[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>
          Temas importantes para escolher deputado{' '}
          <span className="text-xs text-muted-foreground">
            (até {MAX_THEMES} · {value.important_themes.length} selecionados)
          </span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {PRIORITY_THEMES.map((t) => {
            const active = value.important_themes.includes(t);
            const disabled = !active && value.important_themes.length >= MAX_THEMES;
            return (
              <button
                type="button"
                key={t}
                onClick={() => toggleTheme(t)}
                disabled={disabled}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-vortex-border bg-vortex-surface/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  disabled && 'cursor-not-allowed opacity-40',
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
        <p className="text-sm font-medium text-foreground">
          Como você avalia esses serviços hoje?
        </p>
        <div className="space-y-2">
          {[
            { key: 'health_rating' as const, label: 'Saúde' },
            { key: 'security_rating' as const, label: 'Segurança' },
            { key: 'employment_rating' as const, label: 'Emprego' },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between">
              <span className="text-sm text-foreground/90">{row.label}</span>
              <StarRating
                value={value[row.key]}
                onChange={(n) => onChange({ [row.key]: n } as Partial<QuestionarioState>)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="neighborhood_complaint">
          O que mais incomoda no bairro? (opcional)
        </Label>
        <Textarea
          id="neighborhood_complaint"
          rows={3}
          value={value.neighborhood_complaint ?? ''}
          onChange={(e) => onChange({ neighborhood_complaint: e.target.value })}
        />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// BLOCO 4 — Avaliação de Governo
// --------------------------------------------------------------------------
export function GovernoBlock({ value, onChange }: BlockProps) {
  const govOptions = (Object.keys(GOV_RATING_LABEL) as GovRating[]).map((v) => ({
    v,
    label: GOV_RATING_LABEL[v],
  }));
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Governo estadual (MG)</Label>
        <PillGroup<GovRating>
          value={value.state_gov_rating}
          onChange={(v) => onChange({ state_gov_rating: v })}
          options={govOptions}
        />
      </div>
      <div className="space-y-2">
        <Label>Governo federal</Label>
        <PillGroup<GovRating>
          value={value.federal_gov_rating}
          onChange={(v) => onChange({ federal_gov_rating: v })}
          options={govOptions}
        />
      </div>
      <div className="space-y-2">
        <Label>Prefeitura local</Label>
        <PillGroup<GovRating>
          value={value.city_gov_rating}
          onChange={(v) => onChange({ city_gov_rating: v })}
          options={govOptions}
        />
      </div>
      <div className="space-y-2">
        <Label>O Brasil está no caminho certo ou errado?</Label>
        <PillGroup<CountryDirection>
          value={value.country_direction}
          onChange={(v) => onChange({ country_direction: v })}
          options={(Object.keys(COUNTRY_DIRECTION_LABEL) as CountryDirection[]).map(
            (v) => ({ v, label: COUNTRY_DIRECTION_LABEL[v] }),
          )}
        />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// BLOCO 5 — Observações de Campo
// --------------------------------------------------------------------------
export function CampoBlock({ value, onChange }: BlockProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="notes_extra">Observações do entrevistador</Label>
        <Textarea
          id="notes_extra"
          rows={5}
          value={value.notes_extra ?? ''}
          onChange={(e) => onChange({ notes_extra: e.target.value })}
          placeholder="Reações, contexto, próximos passos…"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Receptividade geral</Label>
          <span className="text-sm text-muted-foreground">
            {value.receptivity_field}/5
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value.receptivity_field}
          onChange={(e) => onChange({ receptivity_field: Number(e.target.value) })}
          className="w-full accent-vortex-lime"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
        <Checkbox
          checked={value.is_potential_leader}
          onCheckedChange={(c) => onChange({ is_potential_leader: c === true })}
        />
        <span className="text-sm text-foreground">
          É potencial multiplicador / liderança local?
        </span>
      </label>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-vortex-border bg-vortex-surface/40 p-3">
        <Checkbox
          checked={value.accepted_contact}
          onCheckedChange={(c) => onChange({ accepted_contact: c === true })}
        />
        <span className="text-sm text-foreground">
          Aceitou receber contato da campanha?
        </span>
      </label>
    </div>
  );
}

// Convenções pro stepper.
export const BLOCK_TITLES = [
  'Perfil',
  'Cenário',
  'Temas',
  'Governo',
  'Campo',
] as const;
