-- ============================================================================
-- Vórtice — migration 034 — Perguntas Regionais por Campanha
--
-- Banco de perguntas customizadas por campanha (exibidas como "Bloco 6" no
-- final do questionário aprofundado) + respostas por entrevista.
--
-- (A 033 já é o soft delete de campanha; por isso esta é a 034.)
--
-- Helpers reais do projeto: current_campaign_id() / current_user_role() /
-- is_super_admin(). PKs com gen_random_uuid(). Idempotente.
-- ============================================================================

-- 1) Banco de perguntas regionais por campanha ------------------------------
create table if not exists public.campaign_questions (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  text        text not null,
  type        text not null check (type in (
                'yes_no','multiple_choice','scale_1_5','free_text','single_choice')),
  options     jsonb,                              -- multiple_choice / single_choice
  is_required boolean not null default false,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_campaign_questions_campaign
  on public.campaign_questions(campaign_id, sort_order);

alter table public.campaign_questions enable row level security;

-- Gerenciar (CRUD): admin da campanha OU super admin (god mode / view-as).
drop policy if exists campaign_questions_manage on public.campaign_questions;
create policy campaign_questions_manage on public.campaign_questions
  for all using (
    public.is_super_admin()
    or (campaign_id = public.current_campaign_id() and public.current_user_role() = 'admin')
  )
  with check (
    public.is_super_admin()
    or (campaign_id = public.current_campaign_id() and public.current_user_role() = 'admin')
  );

-- Ler: qualquer membro da campanha (pra exibir na entrevista).
drop policy if exists campaign_questions_read on public.campaign_questions;
create policy campaign_questions_read on public.campaign_questions
  for select using (
    public.is_super_admin()
    or campaign_id = public.current_campaign_id()
  );

-- 2) Respostas das perguntas regionais por entrevista -----------------------
create table if not exists public.interview_custom_answers (
  id             uuid primary key default gen_random_uuid(),
  interview_id   uuid not null references public.field_interviews(id) on delete cascade,
  campaign_id    uuid not null references public.campaigns(id) on delete cascade,
  question_id    uuid not null references public.campaign_questions(id) on delete cascade,
  answer_text    text,            -- free_text
  answer_option  text,            -- yes_no / single_choice
  answer_options text[],          -- multiple_choice
  answer_scale   integer,         -- scale_1_5
  created_at     timestamptz not null default now(),
  unique (interview_id, question_id)
);

create index if not exists idx_custom_answers_interview
  on public.interview_custom_answers(interview_id);
create index if not exists idx_custom_answers_campaign
  on public.interview_custom_answers(campaign_id, question_id);

alter table public.interview_custom_answers enable row level security;

drop policy if exists interview_custom_answers_all on public.interview_custom_answers;
create policy interview_custom_answers_all on public.interview_custom_answers
  for all using (
    public.is_super_admin()
    or campaign_id = public.current_campaign_id()
  )
  with check (
    public.is_super_admin()
    or campaign_id = public.current_campaign_id()
  );

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='campaign_questions')
     and exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='interview_custom_answers')
    then 'OK migration 034 aplicada (perguntas regionais)'
    else 'FALHA'
  end as status;
