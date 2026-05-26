-- ============================================================================
-- Vórtice — migration 004 — camada de Super Admin (Vórtice como dono do SaaS)
--
-- - super_admins: funcionários da Vórtice (vê todas as campanhas)
-- - campaigns ganha status (trial/active/suspended/cancelled), trial_ends_at, notes
-- - is_super_admin(): função helper usada pelas policies
-- - Policies atualizadas para permitir super admin ler/editar metadados
-- - current_campaign_id(): retorna NULL se a campanha estiver suspensa/cancelada
-- ============================================================================

-- 1) Enum de status da campanha
do $$ begin
  create type campaign_status as enum ('trial', 'active', 'suspended', 'cancelled');
exception when duplicate_object then null; end $$;

-- 2) Tabela super_admins
create table if not exists public.super_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;

-- super_admins só é legível pelos próprios super_admins
drop policy if exists super_admins_select on public.super_admins;
create policy super_admins_select on public.super_admins
  for select using (
    exists (
      select 1 from public.super_admins where user_id = auth.uid()
    )
  );

-- 3) Função is_super_admin()
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.super_admins where user_id = auth.uid()
  )
$$;

-- 4) Campos novos em campaigns
alter table public.campaigns
  add column if not exists status campaign_status not null default 'trial';

alter table public.campaigns
  add column if not exists trial_ends_at timestamptz;

alter table public.campaigns
  add column if not exists notes text;

create index if not exists campaigns_status_idx on public.campaigns (status);

-- 5) current_campaign_id agora exige campanha ativa ou trial
create or replace function public.current_campaign_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cu.campaign_id
  from public.campaign_users cu
  join public.campaigns c on c.id = cu.campaign_id
  where cu.user_id = auth.uid()
    and cu.is_active = true
    and c.status in ('trial', 'active')
  limit 1
$$;

-- 6) Policies de campaigns: super admin vê e edita TUDO, admin local vê só a própria
drop policy if exists campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns
  for select using (
    public.is_super_admin()
    or id = public.current_campaign_id()
  );

drop policy if exists campaigns_insert on public.campaigns;
create policy campaigns_insert on public.campaigns
  for insert with check (public.is_super_admin());

drop policy if exists campaigns_update on public.campaigns;
create policy campaigns_update on public.campaigns
  for update using (
    public.is_super_admin()
    or (id = public.current_campaign_id() and public.current_user_role() = 'admin')
  );

drop policy if exists campaigns_delete on public.campaigns;
create policy campaigns_delete on public.campaigns
  for delete using (public.is_super_admin());

-- 7) Policies de campaign_users: super admin vê todos os memberships
drop policy if exists campaign_users_select on public.campaign_users;
create policy campaign_users_select on public.campaign_users
  for select using (
    public.is_super_admin()
    or campaign_id = public.current_campaign_id()
  );

-- modify (insert/update/delete) — admin local da campanha OU super admin
drop policy if exists campaign_users_modify on public.campaign_users;
create policy campaign_users_modify on public.campaign_users
  for all using (
    public.is_super_admin()
    or (
      campaign_id = public.current_campaign_id()
      and public.current_user_role() in ('admin', 'coordinator')
    )
  )
  with check (
    public.is_super_admin()
    or (
      campaign_id = public.current_campaign_id()
      and public.current_user_role() in ('admin', 'coordinator')
    )
  );

-- 8) profiles: super admin enxerga todos
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    public.is_super_admin()
    or id = auth.uid()
    or exists (
      select 1 from public.campaign_users cu
      where cu.user_id = profiles.id
        and cu.campaign_id = public.current_campaign_id()
    )
  );

-- 9) RPC para listar campanhas com contagens (para /admin/campaigns)
create or replace function public.list_campaigns_overview()
returns table (
  id uuid,
  candidate_name text,
  party text,
  party_number text,
  state text,
  office text,
  election_year int,
  status campaign_status,
  trial_ends_at timestamptz,
  notes text,
  created_at timestamptz,
  members_count bigint,
  supporters_count bigint,
  voters_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.candidate_name,
    c.party,
    c.party_number,
    c.state,
    c.office,
    c.election_year,
    c.status,
    c.trial_ends_at,
    c.notes,
    c.created_at,
    (select count(*) from public.campaign_users cu where cu.campaign_id = c.id and cu.is_active),
    (select count(*) from public.supporters s where s.campaign_id = c.id),
    (select count(*) from public.voters v where v.campaign_id = c.id)
  from public.campaigns c
  where public.is_super_admin()
  order by c.created_at desc
$$;

grant execute on function public.list_campaigns_overview() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'super_admins'
    )
    and exists (
      select 1 from information_schema.columns
      where table_name = 'campaigns' and column_name = 'status'
    )
    then 'OK — migration 004 aplicada'
    else 'FALHA'
  end as status;
