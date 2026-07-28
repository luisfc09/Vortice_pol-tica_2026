-- ============================================================================
-- Vórtice — migration 052 — Formulários de Pesquisa (novo módulo, FASE 0)
--
-- Introduz o conceito de "Formulário de Pesquisa": um formulário nomeado,
-- criado pelo admin, com demografia fixa (nome, faixa etária, sexo, religião)
-- + perguntas próprias daquele formulário. O MESMO formulário pode ser:
--   • aplicado por ENTREVISTADORES autorizados (canal presencial), e/ou
--   • publicado como LINK PÚBLICO pro eleitor (canal público).
-- As respostas dos dois canais caem num repositório único por formulário.
--
-- ⚠️ FASE 0 é 100% ADITIVA: cria 4 tabelas NOVAS. NÃO toca em field_interviews,
-- campaign_questions, public_surveys nem em nada da Inteligência. Todo o fluxo
-- antigo continua funcionando intacto. A troca de chave é uma fase posterior.
--
-- Helpers do projeto: current_campaign_id() / current_user_role() /
-- is_super_admin(). Idempotente.
-- ============================================================================

-- 1) survey_forms — o formulário nomeado ------------------------------------
create table if not exists public.survey_forms (
  id                     uuid primary key default gen_random_uuid(),
  campaign_id            uuid not null references public.campaigns(id) on delete cascade,
  name                   text not null,
  description            text,
  -- Demografia FIXA (nome/faixa/sexo/religião sempre coletados) — sem toggle.
  -- Opcionais que o admin liga por formulário:
  collect_phone          boolean not null default true,
  collect_municipality   boolean not null default true,
  collect_neighborhood   boolean not null default true,
  -- Publicação como link público (canal público):
  is_public              boolean not null default false,
  share_token            text not null unique
                             default encode(gen_random_bytes(8), 'hex'),  -- 16 hex
  public_starts_at       timestamptz,
  public_ends_at         timestamptz,
  allow_multiple_per_ip  boolean not null default false,
  -- Estado geral:
  is_active              boolean not null default true,
  response_count         integer not null default 0,   -- denormalizado (trigger)
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (public_ends_at is null or public_starts_at is null
         or public_ends_at > public_starts_at)
);

create index if not exists idx_survey_forms_campaign
  on public.survey_forms(campaign_id, is_active);
create index if not exists idx_survey_forms_token
  on public.survey_forms(share_token);

-- 2) survey_form_questions — perguntas DAQUELE formulário --------------------
-- Diferente de campaign_questions (banco compartilhado da campanha): aqui a
-- pergunta pertence a UM formulário. Mesmos 5 tipos já usados no projeto.
create table if not exists public.survey_form_questions (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.survey_forms(id) on delete cascade,
  text         text not null,
  type         text not null check (type in (
                 'yes_no','multiple_choice','single_choice','scale_1_5','free_text')),
  options      jsonb,                          -- multiple_choice / single_choice
  is_required  boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_survey_form_questions_form
  on public.survey_form_questions(form_id, position);

-- 3) survey_form_assignments — entrevistadores autorizados -------------------
create table if not exists public.survey_form_assignments (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.survey_forms(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  assigned_by  uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  unique (form_id, user_id)
);

create index if not exists idx_survey_form_assignments_form
  on public.survey_form_assignments(form_id);
create index if not exists idx_survey_form_assignments_user
  on public.survey_form_assignments(user_id);

-- 4) survey_responses — repositório único (presencial + público) -------------
create table if not exists public.survey_responses (
  id                  uuid primary key default gen_random_uuid(),
  form_id             uuid not null references public.survey_forms(id) on delete cascade,
  campaign_id         uuid not null references public.campaigns(id) on delete cascade,
  channel             text not null check (channel in ('presencial','publico')),
  interviewer_id      uuid references auth.users(id),   -- só presencial
  -- Demografia (mesmos domínios validados na camada TS: AgeRange/Gender/Religion)
  respondent_name     text,
  age_range           text,
  gender              text,
  religion            text,
  respondent_phone    text,
  municipality_code   text references public.municipalities(ibge_code),
  neighborhood        text,
  -- Respostas das perguntas: { survey_form_questions.id : valor }
  answers             jsonb not null default '{}'::jsonb,
  -- Presencial (GPS) / Público (anti-fraude)
  lat                 double precision,
  lng                 double precision,
  ip_hash             text,
  user_agent          text,
  submitted_at        timestamptz not null default now()
);

create index if not exists idx_survey_responses_form
  on public.survey_responses(form_id, submitted_at desc);
create index if not exists idx_survey_responses_campaign
  on public.survey_responses(campaign_id, submitted_at desc);
create index if not exists idx_survey_responses_channel
  on public.survey_responses(form_id, channel);
create index if not exists idx_survey_responses_ip
  on public.survey_responses(form_id, ip_hash);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.survey_forms           enable row level security;
alter table public.survey_form_questions  enable row level security;
alter table public.survey_form_assignments enable row level security;
alter table public.survey_responses        enable row level security;

-- ---- survey_forms ----------------------------------------------------------
-- Ler: qualquer membro da campanha (admin gerencia, entrevistador precisa ler
-- pra aplicar). O app filtra o que cada entrevistador vê via assignments.
drop policy if exists survey_forms_read on public.survey_forms;
create policy survey_forms_read on public.survey_forms
  for select using (
    public.is_super_admin()
    or campaign_id = public.current_campaign_id()
  );

-- Gerenciar (CRUD): admin OU candidate da campanha, OU super admin.
drop policy if exists survey_forms_manage on public.survey_forms;
create policy survey_forms_manage on public.survey_forms
  for all using (
    public.is_super_admin()
    or (campaign_id = public.current_campaign_id()
        and public.current_user_role() in ('admin','candidate'))
  )
  with check (
    public.is_super_admin()
    or (campaign_id = public.current_campaign_id()
        and public.current_user_role() in ('admin','candidate'))
  );

-- ---- survey_form_questions -------------------------------------------------
drop policy if exists survey_form_questions_read on public.survey_form_questions;
create policy survey_form_questions_read on public.survey_form_questions
  for select using (
    public.is_super_admin()
    or exists (
      select 1 from public.survey_forms f
      where f.id = survey_form_questions.form_id
        and f.campaign_id = public.current_campaign_id()
    )
  );

drop policy if exists survey_form_questions_manage on public.survey_form_questions;
create policy survey_form_questions_manage on public.survey_form_questions
  for all using (
    public.is_super_admin()
    or exists (
      select 1 from public.survey_forms f
      where f.id = survey_form_questions.form_id
        and f.campaign_id = public.current_campaign_id()
        and public.current_user_role() in ('admin','candidate')
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.survey_forms f
      where f.id = survey_form_questions.form_id
        and f.campaign_id = public.current_campaign_id()
        and public.current_user_role() in ('admin','candidate')
    )
  );

-- ---- survey_form_assignments -----------------------------------------------
-- Ler: admin/candidate da campanha OU o próprio usuário autorizado.
drop policy if exists survey_form_assignments_read on public.survey_form_assignments;
create policy survey_form_assignments_read on public.survey_form_assignments
  for select using (
    public.is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.survey_forms f
      where f.id = survey_form_assignments.form_id
        and f.campaign_id = public.current_campaign_id()
        and public.current_user_role() in ('admin','candidate','coordinator')
    )
  );

drop policy if exists survey_form_assignments_manage on public.survey_form_assignments;
create policy survey_form_assignments_manage on public.survey_form_assignments
  for all using (
    public.is_super_admin()
    or exists (
      select 1 from public.survey_forms f
      where f.id = survey_form_assignments.form_id
        and f.campaign_id = public.current_campaign_id()
        and public.current_user_role() in ('admin','candidate')
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.survey_forms f
      where f.id = survey_form_assignments.form_id
        and f.campaign_id = public.current_campaign_id()
        and public.current_user_role() in ('admin','candidate')
    )
  );

-- ---- survey_responses ------------------------------------------------------
-- Ler: admin/candidate/coordinator/researcher da campanha (repositório/analytics)
-- OU o entrevistador que gravou (vê as próprias).
drop policy if exists survey_responses_read on public.survey_responses;
create policy survey_responses_read on public.survey_responses
  for select using (
    public.is_super_admin()
    or interviewer_id = auth.uid()
    or (campaign_id = public.current_campaign_id()
        and public.current_user_role() in ('admin','candidate','coordinator','researcher'))
  );

-- INSERT presencial: entrevistador AUTORIZADO no formulário, gravando como si
-- mesmo. Respostas públicas entram por RPC/service_role (fase 3), não por aqui.
drop policy if exists survey_responses_insert_presencial on public.survey_responses;
create policy survey_responses_insert_presencial on public.survey_responses
  for insert with check (
    channel = 'presencial'
    and interviewer_id = auth.uid()
    and campaign_id = public.current_campaign_id()
    and exists (
      select 1 from public.survey_form_assignments a
      where a.form_id = survey_responses.form_id
        and a.user_id = auth.uid()
    )
  );

-- Apagar: só admin/candidate/super (limpeza de spam/erro).
drop policy if exists survey_responses_delete on public.survey_responses;
create policy survey_responses_delete on public.survey_responses
  for delete using (
    public.is_super_admin()
    or (campaign_id = public.current_campaign_id()
        and public.current_user_role() in ('admin','candidate'))
  );

-- ============================================================================
-- Triggers: response_count denormalizado + updated_at
-- ============================================================================
create or replace function public.tg_survey_form_bump_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.survey_forms
       set response_count = response_count + 1
     where id = new.form_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.survey_forms
       set response_count = greatest(0, response_count - 1)
     where id = old.form_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists tg_bump_survey_response_count on public.survey_responses;
create trigger tg_bump_survey_response_count
after insert or delete on public.survey_responses
for each row execute function public.tg_survey_form_bump_count();

create or replace function public.tg_survey_form_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tg_touch_survey_form on public.survey_forms;
create trigger tg_touch_survey_form
before update on public.survey_forms
for each row execute function public.tg_survey_form_touch();

drop trigger if exists tg_touch_survey_form_question on public.survey_form_questions;
create trigger tg_touch_survey_form_question
before update on public.survey_form_questions
for each row execute function public.tg_survey_form_touch();

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='survey_forms')
     and exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='survey_form_questions')
     and exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='survey_form_assignments')
     and exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='survey_responses')
    then 'OK migration 052 aplicada (formularios de pesquisa - fase 0)'
    else 'FALHA'
  end as status;
