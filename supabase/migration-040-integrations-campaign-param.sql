-- ============================================================
-- Vórtice — migration-040 — super admin opera a campanha do "Ver como cliente"
-- em Integrações.
--
-- list_integrations_safe passa a aceitar p_campaign_id (opcional): se informado
-- E o caller é super admin OU membro ativo daquela campanha, lista as
-- integrações dela; senão cai no current_campaign_id() (comportamento atual,
-- zero impacto para usuários comuns).
-- ============================================================

drop function if exists public.list_integrations_safe();

create or replace function public.list_integrations_safe(p_campaign_id uuid default null)
returns table (
  id uuid,
  type integration_type,
  is_enabled boolean,
  config jsonb,
  has_secret boolean,
  secret_keys text[],
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  with target as (
    select case
      when p_campaign_id is not null and (
        public.is_super_admin()
        or exists (
          select 1 from public.campaign_users cu
          where cu.user_id = auth.uid()
            and cu.campaign_id = p_campaign_id
            and cu.is_active = true
        )
      )
      then p_campaign_id
      else public.current_campaign_id()
    end as cid
  )
  select
    i.id, i.type, i.is_enabled, i.config,
    (jsonb_typeof(i.secrets) = 'object' and i.secrets != '{}'::jsonb) as has_secret,
    (
      case
        when jsonb_typeof(i.secrets) = 'object'
        then (select coalesce(array_agg(key order by key), '{}'::text[])
              from jsonb_object_keys(i.secrets) as key)
        else '{}'::text[]
      end
    ) as secret_keys,
    i.last_test_at, i.last_test_ok, i.last_test_message, i.updated_at
  from public.integrations i, target
  where i.campaign_id = target.cid;
$$;

grant execute on function public.list_integrations_safe(uuid) to authenticated;

-- Verificação
select
  case when exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'list_integrations_safe'
      and p.pronargs = 1
  ) then 'OK migration 040 (list_integrations_safe com p_campaign_id)'
  else 'FALHA' end as status;
