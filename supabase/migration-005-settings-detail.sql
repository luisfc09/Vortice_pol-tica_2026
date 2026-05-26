-- ============================================================================
-- Vórtice — migration 005
-- - app_settings: configurações globais do SaaS (1 linha)
-- - get_campaign_detail(uuid): RPC para super admin ver detalhes
-- - Policies: super admin pode LER dados internos das campanhas (read-only)
-- ============================================================================

-- 1) Tabela singleton de configuração global
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  product_name text not null default 'Vórtice',
  product_slogan text not null default 'Estratégia que move eleições.',
  support_email text not null default 'suporte@vortice.app',
  default_vote_target int not null default 350000,
  default_trial_days int not null default 30,
  default_state text not null default 'MG',
  terms_url text,
  privacy_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

insert into public.app_settings (id) values (1)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

-- Leitura: qualquer authenticated user pode ler config global (branding etc.)
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select using (auth.uid() is not null);

-- Escrita: somente super admin
drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings
  for update using (public.is_super_admin())
  with check (public.is_super_admin());

-- 2) Policies cross-tenant para super admin LER dados internos
drop policy if exists supporters_super_admin_select on public.supporters;
create policy supporters_super_admin_select on public.supporters
  for select using (public.is_super_admin());

drop policy if exists voters_super_admin_select on public.voters;
create policy voters_super_admin_select on public.voters
  for select using (public.is_super_admin());

drop policy if exists field_interviews_super_admin_select on public.field_interviews;
create policy field_interviews_super_admin_select on public.field_interviews
  for select using (public.is_super_admin());

drop policy if exists events_super_admin_select on public.events;
create policy events_super_admin_select on public.events
  for select using (public.is_super_admin());

drop policy if exists mentions_super_admin_select on public.mentions;
create policy mentions_super_admin_select on public.mentions
  for select using (public.is_super_admin());

drop policy if exists alerts_super_admin_select on public.alerts;
create policy alerts_super_admin_select on public.alerts
  for select using (public.is_super_admin());

-- 3) RPC: retorna dados detalhados de uma campanha (cabeçalho + members)
create or replace function public.get_campaign_detail(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Apenas Super Admin pode acessar detalhes globais';
  end if;

  select jsonb_build_object(
    'campaign', to_jsonb(c.*),
    'members',
      coalesce(
        (
          select jsonb_agg(jsonb_build_object(
            'id', cu.id,
            'user_id', cu.user_id,
            'role', cu.role,
            'is_active', cu.is_active,
            'invited_by', cu.invited_by,
            'created_at', cu.created_at,
            'profile', to_jsonb(p.*),
            'email', u.email,
            'last_sign_in_at', u.last_sign_in_at
          ))
          from public.campaign_users cu
          left join public.profiles p on p.id = cu.user_id
          left join auth.users u on u.id = cu.user_id
          where cu.campaign_id = c.id
        ),
        '[]'::jsonb
      ),
    'metrics',
      jsonb_build_object(
        'supporters_count',
          (select count(*) from public.supporters where campaign_id = c.id),
        'voters_count',
          (select count(*) from public.voters where campaign_id = c.id),
        'interviews_count',
          (select count(*) from public.field_interviews where campaign_id = c.id),
        'events_count',
          (select count(*) from public.events where campaign_id = c.id),
        'mentions_count',
          (select count(*) from public.mentions where campaign_id = c.id),
        'alerts_open',
          (select count(*) from public.alerts where campaign_id = c.id and is_read = false)
      )
  )
  into result
  from public.campaigns c
  where c.id = p_campaign_id;

  return result;
end;
$$;

grant execute on function public.get_campaign_detail(uuid) to authenticated;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'app_settings'
    )
    and exists (
      select 1 from public.app_settings where id = 1
    )
    then 'OK — migration 005 aplicada'
    else 'FALHA'
  end as status;
