-- ============================================================================
-- Vórtice — migration 018 — Questionário aprofundado de campo
--
-- Adiciona ~25 colunas em field_interviews pra capturar o questionário
-- aprofundado (perfil, cenário, governo, etc.) sem quebrar inserts que
-- só preenchem os campos básicos.
--
-- Todas as colunas são NULLABLE — entrevistas existentes ou novas via
-- "Salvar rápido" continuam funcionando.
--
-- status: 'basic' | 'draft' | 'complete'
--   - default 'complete' pra não quebrar registros antigos
--   - 'draft' é atribuído quando o usuário escolhe "Salvar e aprofundar"
--     mas ainda não finalizou o questionário
-- ============================================================================

alter table public.field_interviews
  add column if not exists status text default 'complete',
  add column if not exists age_range text,
  add column if not exists gender text,
  add column if not exists education text,
  add column if not exists income_range text,
  add column if not exists work_status text,
  add column if not exists religion text,
  add column if not exists vote_decision text,
  add column if not exists candidate_awareness text,
  add column if not exists candidate_opinion text,
  add column if not exists conversion_argument text,
  add column if not exists main_city_problem text,
  add column if not exists important_themes text[],
  add column if not exists health_rating integer,
  add column if not exists security_rating integer,
  add column if not exists employment_rating integer,
  add column if not exists neighborhood_complaint text,
  add column if not exists state_gov_rating text,
  add column if not exists federal_gov_rating text,
  add column if not exists city_gov_rating text,
  add column if not exists country_direction text,
  add column if not exists is_potential_leader boolean default false,
  add column if not exists accepted_contact boolean default false,
  add column if not exists ai_analysis jsonb,
  add column if not exists interview_duration_seconds integer;

-- Constraints leves de domínio (CHECK só nos campos que tem valores fechados).
-- Postgres aceita NULL nessas checks por padrão.
do $$ begin
  alter table public.field_interviews
    add constraint field_interviews_status_check
    check (status in ('basic', 'draft', 'complete'));
exception when duplicate_object then null; end $$;

create index if not exists field_interviews_status_idx
  on public.field_interviews (campaign_id, status);

-- Verificação --------------------------------------------------------------
select
  case
    when (
      select count(*) from information_schema.columns
      where table_name = 'field_interviews'
        and column_name in (
          'status', 'age_range', 'gender', 'education', 'income_range',
          'work_status', 'religion', 'vote_decision', 'candidate_awareness',
          'candidate_opinion', 'conversion_argument', 'main_city_problem',
          'important_themes', 'health_rating', 'security_rating',
          'employment_rating', 'neighborhood_complaint', 'state_gov_rating',
          'federal_gov_rating', 'city_gov_rating', 'country_direction',
          'is_potential_leader', 'accepted_contact', 'ai_analysis',
          'interview_duration_seconds'
        )
    ) >= 25
    then 'OK — migration 018 aplicada (25 colunas do questionário aprofundado)'
    else 'FALHA — esperado ≥25 colunas'
  end as status;
