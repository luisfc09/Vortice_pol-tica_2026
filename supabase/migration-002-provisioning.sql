-- ============================================================================
-- Vórtice — migration 002
-- Adiciona provisionamento ativo pelo admin:
--   - campaign_users.is_active     → admin pode desativar sem deletar
--   - profiles.must_change_password → força troca de senha no primeiro acesso
--
-- Rode UMA VEZ no SQL Editor após schema.sql.
-- ============================================================================

-- 1) is_active em campaign_users
alter table campaign_users
  add column if not exists is_active boolean not null default true;

create index if not exists campaign_users_active_idx
  on campaign_users (campaign_id, is_active);

-- 2) must_change_password em profiles
alter table profiles
  add column if not exists must_change_password boolean not null default false;

-- 3) RPC current_campaign_id passa a ignorar memberships inativos
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
    and is_active = true
  limit 1
$$;

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
    and is_active = true
  limit 1
$$;

-- 4) RPC para o admin saber se o user está provisionado (usado pelo login)
create or replace function public.is_user_provisioned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_users
    where user_id = p_user_id and is_active = true
  )
$$;

-- ============================================================================
-- Verificação: deve retornar 'OK' se a migration foi aplicada
-- ============================================================================
select
  case
    when exists (
      select 1 from information_schema.columns
      where table_name = 'campaign_users' and column_name = 'is_active'
    )
    and exists (
      select 1 from information_schema.columns
      where table_name = 'profiles' and column_name = 'must_change_password'
    )
    then 'OK — migration aplicada'
    else 'FALHA — colunas não foram criadas'
  end as status;
