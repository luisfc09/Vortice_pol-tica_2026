-- ============================================================================
-- Vórtice — schema completo para Supabase
-- Multi-tenant por campaign_id; RLS sempre que toca dados sensíveis.
-- Rode este arquivo no SQL editor do Supabase numa instância nova.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMs
-- ----------------------------------------------------------------------------
do $$ begin
  -- Conjunto atual de papéis (ver migration-015). field_agent fica como
  -- legado pra compat com instalações antigas.
  create type user_role as enum (
    'admin',
    'candidate',
    'coordinator',
    'researcher',
    'supporter',
    'leader',
    'field_agent'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type vote_intention as enum (
    'apoiador', 'tendencia_apoio', 'indeciso', 'tendencia_oposicao', 'oposicao'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type supporter_role_type as enum ('lider', 'cabo', 'militante', 'apoiador');
exception when duplicate_object then null; end $$;

do $$ begin
  create type supporter_status as enum ('ativo', 'inativo', 'pendente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mention_source as enum ('twitter', 'google_news', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sentiment as enum ('positivo', 'neutro', 'negativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_type as enum (
    'spike_negativo', 'municipio_inativo', 'meta_atingida', 'sistema'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type as enum ('comicio', 'reuniao', 'visita', 'midia', 'outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type faq_category as enum (
    'seguranca', 'saude', 'emprego', 'educacao',
    'infraestrutura', 'politica', 'partido', 'local_mg'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  candidate_name text not null,
  party text not null,
  party_number text not null,
  state text not null,
  office text not null,
  election_year int not null,
  logo_url text,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  municipality_code text,
  created_at timestamptz not null default now()
);

create table if not exists campaign_users (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role user_role not null default 'leader',
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);
create index if not exists campaign_users_user_idx on campaign_users (user_id);
create index if not exists campaign_users_campaign_idx on campaign_users (campaign_id);

create table if not exists municipalities (
  ibge_code text primary key,
  name text not null,
  state text not null,
  population int not null default 0,
  region text not null
);
create index if not exists municipalities_state_idx on municipalities (state);

create table if not exists supporters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  name text not null,
  cpf text,
  phone text,
  email text,
  city text not null,
  neighborhood text,
  municipality_code text references municipalities (ibge_code),
  role supporter_role_type not null default 'militante',
  status supporter_status not null default 'ativo',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists supporters_campaign_idx on supporters (campaign_id);
create index if not exists supporters_muni_idx on supporters (municipality_code);

create table if not exists voters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  name text not null,
  phone text,
  address text,
  city text not null,
  municipality_code text references municipalities (ibge_code),
  vote_intention vote_intention not null default 'indeciso',
  notes text,
  lat double precision,
  lng double precision,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists voters_campaign_idx on voters (campaign_id);
create index if not exists voters_muni_idx on voters (municipality_code);
create index if not exists voters_intention_idx on voters (vote_intention);

create table if not exists field_interviews (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  voter_name text not null,
  voter_phone text,
  municipality_code text references municipalities (ibge_code),
  neighborhood text,
  vote_intention vote_intention not null default 'indeciso',
  receptivity_score int not null check (receptivity_score between 1 and 5),
  priority_themes text[] not null default '{}',
  vote_decided boolean not null default false,
  notes text,
  lat double precision,
  lng double precision,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists field_interviews_campaign_idx on field_interviews (campaign_id);
create index if not exists field_interviews_created_at_idx on field_interviews (created_at desc);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  title text not null,
  location text,
  city text,
  date timestamptz not null,
  type event_type not null default 'outro',
  description text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists events_campaign_idx on events (campaign_id);
create index if not exists events_date_idx on events (date);

create table if not exists mentions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  source mention_source not null,
  content text not null,
  url text,
  author text,
  sentiment sentiment not null default 'neutro',
  sentiment_score numeric(4,3) not null default 0,
  published_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists mentions_campaign_idx on mentions (campaign_id);
create index if not exists mentions_published_idx on mentions (published_at desc);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  type alert_type not null,
  message text not null,
  meta jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists alerts_campaign_idx on alerts (campaign_id);
create index if not exists alerts_unread_idx on alerts (campaign_id, is_read) where is_read = false;

create table if not exists faq_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns (id) on delete cascade,  -- null = global
  category faq_category not null,
  question text not null,
  suggested_answer text not null,
  support_data text not null default '',
  avoid_saying text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists faq_items_campaign_idx on faq_items (campaign_id);
create index if not exists faq_items_category_idx on faq_items (category);

-- ----------------------------------------------------------------------------
-- Helpers de RLS
-- ----------------------------------------------------------------------------

-- Retorna o campaign_id da campanha do usuário logado.
create or replace function public.current_campaign_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select campaign_id
  from public.campaign_users
  where user_id = auth.uid()
  limit 1
$$;

-- Retorna o role do usuário logado na sua campanha.
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.campaign_users
  where user_id = auth.uid()
  limit 1
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table campaigns enable row level security;
alter table profiles enable row level security;
alter table campaign_users enable row level security;
alter table municipalities enable row level security;
alter table supporters enable row level security;
alter table voters enable row level security;
alter table field_interviews enable row level security;
alter table events enable row level security;
alter table mentions enable row level security;
alter table alerts enable row level security;
alter table faq_items enable row level security;

-- campaigns: usuário só vê sua própria campanha
drop policy if exists campaigns_select on campaigns;
create policy campaigns_select on campaigns
  for select using (id = public.current_campaign_id());

drop policy if exists campaigns_update on campaigns;
create policy campaigns_update on campaigns
  for update using (
    id = public.current_campaign_id()
    and public.current_user_role() = 'admin'
  );

-- profiles: cada usuário lê todo mundo da sua campanha; só edita o próprio
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from campaign_users cu
      where cu.user_id = profiles.id
        and cu.campaign_id = public.current_campaign_id()
    )
  );

drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- campaign_users: usuários da mesma campanha se veem; admin/coord gerenciam
drop policy if exists campaign_users_select on campaign_users;
create policy campaign_users_select on campaign_users
  for select using (campaign_id = public.current_campaign_id());

drop policy if exists campaign_users_modify on campaign_users;
create policy campaign_users_modify on campaign_users
  for all using (
    campaign_id = public.current_campaign_id()
    and public.current_user_role() in ('admin', 'coordinator')
  )
  with check (
    campaign_id = public.current_campaign_id()
    and public.current_user_role() in ('admin', 'coordinator')
  );

-- municipalities: leitura pública
drop policy if exists municipalities_select on municipalities;
create policy municipalities_select on municipalities
  for select using (true);

-- Macro para tabelas multi-tenant simples (supporters, voters, etc.)
-- Aplicamos manualmente para cada tabela porque PG não tem macro real.

-- supporters
drop policy if exists supporters_select on supporters;
create policy supporters_select on supporters
  for select using (campaign_id = public.current_campaign_id());
drop policy if exists supporters_insert on supporters;
create policy supporters_insert on supporters
  for insert with check (
    campaign_id = public.current_campaign_id()
    and created_by = auth.uid()
  );
drop policy if exists supporters_update on supporters;
create policy supporters_update on supporters
  for update using (campaign_id = public.current_campaign_id())
  with check (campaign_id = public.current_campaign_id());
drop policy if exists supporters_delete on supporters;
create policy supporters_delete on supporters
  for delete using (
    campaign_id = public.current_campaign_id()
    and public.current_user_role() in ('admin', 'coordinator')
  );

-- voters
drop policy if exists voters_select on voters;
create policy voters_select on voters
  for select using (campaign_id = public.current_campaign_id());
drop policy if exists voters_insert on voters;
create policy voters_insert on voters
  for insert with check (
    campaign_id = public.current_campaign_id()
    and created_by = auth.uid()
  );
drop policy if exists voters_update on voters;
create policy voters_update on voters
  for update using (campaign_id = public.current_campaign_id())
  with check (campaign_id = public.current_campaign_id());
drop policy if exists voters_delete on voters;
create policy voters_delete on voters
  for delete using (
    campaign_id = public.current_campaign_id()
    and public.current_user_role() in ('admin', 'coordinator')
  );

-- field_interviews
drop policy if exists field_interviews_select on field_interviews;
create policy field_interviews_select on field_interviews
  for select using (campaign_id = public.current_campaign_id());
drop policy if exists field_interviews_insert on field_interviews;
create policy field_interviews_insert on field_interviews
  for insert with check (
    campaign_id = public.current_campaign_id()
    and created_by = auth.uid()
  );
drop policy if exists field_interviews_update on field_interviews;
create policy field_interviews_update on field_interviews
  for update using (
    campaign_id = public.current_campaign_id()
    and (created_by = auth.uid() or public.current_user_role() in ('admin', 'coordinator'))
  );

-- events
drop policy if exists events_select on events;
create policy events_select on events
  for select using (campaign_id = public.current_campaign_id());
drop policy if exists events_modify on events;
create policy events_modify on events
  for all using (
    campaign_id = public.current_campaign_id()
    and public.current_user_role() in ('admin', 'coordinator')
  )
  with check (
    campaign_id = public.current_campaign_id()
    and public.current_user_role() in ('admin', 'coordinator')
  );

-- mentions: só admin/coord/researcher
drop policy if exists mentions_select on mentions;
create policy mentions_select on mentions
  for select using (
    campaign_id = public.current_campaign_id()
    and public.current_user_role() in ('admin', 'coordinator', 'researcher')
  );

-- alerts
drop policy if exists alerts_select on alerts;
create policy alerts_select on alerts
  for select using (campaign_id = public.current_campaign_id());
drop policy if exists alerts_update on alerts;
create policy alerts_update on alerts
  for update using (campaign_id = public.current_campaign_id())
  with check (campaign_id = public.current_campaign_id());

-- faq_items: itens globais (campaign_id null) ou da campanha
drop policy if exists faq_items_select on faq_items;
create policy faq_items_select on faq_items
  for select using (
    is_active = true
    and (campaign_id is null or campaign_id = public.current_campaign_id())
  );
drop policy if exists faq_items_modify on faq_items;
create policy faq_items_modify on faq_items
  for all using (
    campaign_id = public.current_campaign_id()
    and public.current_user_role() in ('admin', 'coordinator')
  )
  with check (
    campaign_id = public.current_campaign_id()
    and public.current_user_role() in ('admin', 'coordinator')
  );

-- ----------------------------------------------------------------------------
-- Trigger: criar profile automaticamente ao registrar usuário
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Realtime: publica tabelas que o dashboard observa
-- ----------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table voters;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table supporters;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table field_interviews;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table mentions;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table alerts;
exception when duplicate_object then null; end $$;
