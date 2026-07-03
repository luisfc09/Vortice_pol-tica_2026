-- ============================================================================
-- Vórtice — migration 050 — Pesquisas Públicas (auto-preenchidas pelo eleitor)
--
-- Cria o fluxo "Google Forms da campanha":
--   1. Admin/candidate cria uma pesquisa pública em /pesquisas/publicas
--   2. Sistema gera share_token opaco → link /p/:token
--   3. Admin compartilha via wa.me/ ou copia link
--   4. Eleitor abre no celular (SEM login) → preenche → submete
--   5. Resposta cai em public_survey_responses (RPC bypassa RLS)
--   6. Admin vê contagem/respostas em /pesquisas/publicas/:id
--
-- Reaproveita `campaign_questions` (criada em 034): a pesquisa pública liga a
-- perguntas já cadastradas via tabela de junção `public_survey_questions`.
-- Assim uma pergunta boa serve pro presencial (Bloco 6) e pro público sem
-- duplicação. Admin marca quais incluir na hora de criar a pesquisa.
--
-- Anti-fraude: ip_hash = SHA-256(IP + salt) gravado pela edge function
-- `public-survey-submit` (única que enxerga x-forwarded-for real).
--
-- Helpers do projeto: current_campaign_id() / current_user_role() /
-- is_super_admin(). Idempotente.
-- ============================================================================

-- 1) Tabela principal: uma "campanha de pesquisa" por linha ------------------
create table if not exists public.public_surveys (
  id                     uuid primary key default gen_random_uuid(),
  campaign_id            uuid not null references public.campaigns(id) on delete cascade,
  title                  text not null,
  description            text,
  share_token            text not null unique
                             default encode(gen_random_bytes(8), 'hex'),  -- 16 hex chars
  is_active              boolean not null default true,
  starts_at              timestamptz,
  ends_at                timestamptz,
  ask_name               boolean not null default true,
  ask_phone              boolean not null default true,
  ask_location           boolean not null default true,
  allow_multiple_per_ip  boolean not null default false,
  response_count         integer not null default 0,  -- denormalizado (trigger)
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists idx_public_surveys_campaign
  on public.public_surveys(campaign_id, is_active);
create index if not exists idx_public_surveys_token
  on public.public_surveys(share_token);

-- 2) Tabela de junção: quais campaign_questions estão nesta pesquisa ---------
create table if not exists public.public_survey_questions (
  id           uuid primary key default gen_random_uuid(),
  survey_id    uuid not null references public.public_surveys(id) on delete cascade,
  question_id  uuid not null references public.campaign_questions(id) on delete cascade,
  position     integer not null default 0,
  is_required  boolean not null default false,
  unique (survey_id, question_id)
);

create index if not exists idx_public_survey_questions_survey
  on public.public_survey_questions(survey_id, position);

-- 3) Respostas anônimas do eleitor -------------------------------------------
create table if not exists public.public_survey_responses (
  id                  uuid primary key default gen_random_uuid(),
  survey_id           uuid not null references public.public_surveys(id) on delete cascade,
  campaign_id         uuid not null references public.campaigns(id) on delete cascade,
  respondent_name     text,
  respondent_phone    text,
  respondent_email    text,
  municipality_code   text references public.municipalities(ibge_code),
  neighborhood        text,
  answers             jsonb not null default '{}'::jsonb,  -- { question_id: valor }
  ip_hash             text,                                -- SHA-256(IP + salt)
  user_agent          text,
  submitted_at        timestamptz not null default now()
);

create index if not exists idx_public_survey_responses_survey
  on public.public_survey_responses(survey_id, submitted_at desc);
create index if not exists idx_public_survey_responses_campaign
  on public.public_survey_responses(campaign_id, submitted_at desc);
create index if not exists idx_public_survey_responses_ip
  on public.public_survey_responses(survey_id, ip_hash);

-- ============================================================================
-- 4) RLS
-- ============================================================================
alter table public.public_surveys enable row level security;
alter table public.public_survey_questions enable row level security;
alter table public.public_survey_responses enable row level security;

-- public_surveys ------------------------------------------------------------
-- Ler: qualquer membro da campanha (pra ver quais existem).
drop policy if exists public_surveys_read on public.public_surveys;
create policy public_surveys_read on public.public_surveys
  for select using (
    public.is_super_admin()
    or campaign_id = public.current_campaign_id()
  );

-- Gerenciar (CRUD): admin OU candidate da campanha, OU super admin.
drop policy if exists public_surveys_manage on public.public_surveys;
create policy public_surveys_manage on public.public_surveys
  for all using (
    public.is_super_admin()
    or (
      campaign_id = public.current_campaign_id()
      and public.current_user_role() in ('admin','candidate')
    )
  )
  with check (
    public.is_super_admin()
    or (
      campaign_id = public.current_campaign_id()
      and public.current_user_role() in ('admin','candidate')
    )
  );

-- public_survey_questions ---------------------------------------------------
drop policy if exists public_survey_questions_read on public.public_survey_questions;
create policy public_survey_questions_read on public.public_survey_questions
  for select using (
    public.is_super_admin()
    or exists (
      select 1 from public.public_surveys s
      where s.id = public_survey_questions.survey_id
        and s.campaign_id = public.current_campaign_id()
    )
  );

drop policy if exists public_survey_questions_manage on public.public_survey_questions;
create policy public_survey_questions_manage on public.public_survey_questions
  for all using (
    public.is_super_admin()
    or exists (
      select 1 from public.public_surveys s
      where s.id = public_survey_questions.survey_id
        and s.campaign_id = public.current_campaign_id()
        and public.current_user_role() in ('admin','candidate')
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.public_surveys s
      where s.id = public_survey_questions.survey_id
        and s.campaign_id = public.current_campaign_id()
        and public.current_user_role() in ('admin','candidate')
    )
  );

-- public_survey_responses ---------------------------------------------------
-- Ler: admin/candidate/coordinator/researcher da campanha (quem analisa).
drop policy if exists public_survey_responses_read on public.public_survey_responses;
create policy public_survey_responses_read on public.public_survey_responses
  for select using (
    public.is_super_admin()
    or (
      campaign_id = public.current_campaign_id()
      and public.current_user_role() in ('admin','candidate','coordinator','researcher')
    )
  );

-- INSERT direto BLOQUEADO — só via RPC submit_public_response (SECURITY DEFINER).
-- Motivo: eleitor não tem sessão. RPC valida token, expiração e ip_hash.
-- (Sem policy INSERT → nenhum role consegue inserir direto.)

-- Deletar: só admin/candidate/super admin (pra caso de spam).
drop policy if exists public_survey_responses_delete on public.public_survey_responses;
create policy public_survey_responses_delete on public.public_survey_responses
  for delete using (
    public.is_super_admin()
    or (
      campaign_id = public.current_campaign_id()
      and public.current_user_role() in ('admin','candidate')
    )
  );

-- ============================================================================
-- 5) Trigger: mantém response_count denormalizado + updated_at
-- ============================================================================
create or replace function public.tg_public_survey_bump_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.public_surveys
       set response_count = response_count + 1
     where id = new.survey_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.public_surveys
       set response_count = greatest(0, response_count - 1)
     where id = old.survey_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists tg_bump_response_count on public.public_survey_responses;
create trigger tg_bump_response_count
after insert or delete on public.public_survey_responses
for each row execute function public.tg_public_survey_bump_count();

-- updated_at automático
create or replace function public.tg_public_survey_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tg_touch_public_survey on public.public_surveys;
create trigger tg_touch_public_survey
before update on public.public_surveys
for each row execute function public.tg_public_survey_touch();

-- ============================================================================
-- 6) RPCs públicas (SECURITY DEFINER) — bypassam RLS pro anon
-- ============================================================================

-- 6.1) get_public_survey_by_token — retorna pesquisa + perguntas por token.
-- Usada pela rota /p/:token pra montar o formulário.
-- Rejeita se não existe, está inativa, ou fora da janela starts_at/ends_at.
create or replace function public.get_public_survey_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey public.public_surveys%rowtype;
  v_questions jsonb;
begin
  select * into v_survey
    from public.public_surveys
   where share_token = p_token
   limit 1;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if not v_survey.is_active then
    return jsonb_build_object('error', 'inactive');
  end if;

  if v_survey.starts_at is not null and now() < v_survey.starts_at then
    return jsonb_build_object('error', 'not_started');
  end if;

  if v_survey.ends_at is not null and now() > v_survey.ends_at then
    return jsonb_build_object('error', 'ended');
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id',          q.id,
             'label',       cq.text,
             'type',        cq.type,
             'options',     cq.options,
             'is_required', q.is_required,
             'position',    q.position
           ) order by q.position, cq.text
         ), '[]'::jsonb)
    into v_questions
    from public.public_survey_questions q
    join public.campaign_questions cq on cq.id = q.question_id
   where q.survey_id = v_survey.id
     and cq.is_active = true;

  return jsonb_build_object(
    'id',              v_survey.id,
    'campaign_id',     v_survey.campaign_id,
    'title',           v_survey.title,
    'description',     v_survey.description,
    'ask_name',        v_survey.ask_name,
    'ask_phone',       v_survey.ask_phone,
    'ask_location',    v_survey.ask_location,
    'questions',       v_questions
  );
end;
$$;

grant execute on function public.get_public_survey_by_token(text) to anon, authenticated;

-- 6.2) submit_public_response — insere resposta. Chamada pela edge function
-- `public-survey-submit` (que capta o IP real do x-forwarded-for e hasheia).
-- NÃO grant execute to anon direto — a edge function usa service_role.
create or replace function public.submit_public_response(
  p_token             text,
  p_answers           jsonb,
  p_ip_hash           text,
  p_user_agent        text default null,
  p_name              text default null,
  p_phone             text default null,
  p_email             text default null,
  p_municipality      text default null,
  p_neighborhood      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey public.public_surveys%rowtype;
  v_existing_id uuid;
  v_response_id uuid;
begin
  select * into v_survey
    from public.public_surveys
   where share_token = p_token
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not v_survey.is_active then
    return jsonb_build_object('ok', false, 'error', 'inactive');
  end if;

  if v_survey.starts_at is not null and now() < v_survey.starts_at then
    return jsonb_build_object('ok', false, 'error', 'not_started');
  end if;

  if v_survey.ends_at is not null and now() > v_survey.ends_at then
    return jsonb_build_object('ok', false, 'error', 'ended');
  end if;

  -- Anti-fraude: 1 resposta por IP quando allow_multiple_per_ip=false.
  if not v_survey.allow_multiple_per_ip and p_ip_hash is not null then
    select id into v_existing_id
      from public.public_survey_responses
     where survey_id = v_survey.id
       and ip_hash   = p_ip_hash
     limit 1;
    if found then
      return jsonb_build_object('ok', false, 'error', 'duplicate_ip');
    end if;
  end if;

  insert into public.public_survey_responses (
    survey_id, campaign_id, respondent_name, respondent_phone, respondent_email,
    municipality_code, neighborhood, answers, ip_hash, user_agent
  ) values (
    v_survey.id, v_survey.campaign_id,
    nullif(trim(p_name), ''), nullif(trim(p_phone), ''), nullif(trim(p_email), ''),
    p_municipality, nullif(trim(p_neighborhood), ''),
    coalesce(p_answers, '{}'::jsonb), p_ip_hash, p_user_agent
  )
  returning id into v_response_id;

  return jsonb_build_object('ok', true, 'id', v_response_id);
end;
$$;

-- só service_role executa direto (via edge function); nunca anon direto
revoke all on function public.submit_public_response(text, jsonb, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_public_response(text, jsonb, text, text, text, text, text, text, text) to service_role;

-- ============================================================================
-- 7) Verificação
-- ============================================================================
select
  case
    when exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='public_surveys')
     and exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='public_survey_questions')
     and exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='public_survey_responses')
     and exists (select 1 from pg_proc where proname='get_public_survey_by_token')
     and exists (select 1 from pg_proc where proname='submit_public_response')
    then 'OK migration 050 aplicada (pesquisas públicas)'
    else 'FALHA'
  end as status;
