-- ============================================================================
-- Vórtice — migration 028 — Integração Asaas GLOBAL (cobrança do SaaS)
--
-- Conta ÚNICA da Vórtice pra cobrar a mensalidade dos clientes — diferente
-- das integrações por campanha (tabela `integrations`). Por isso vive numa
-- tabela própria, acessível SÓ pelo super admin.
--
-- Segurança: a API Key NUNCA volta pro client. SELECT direto é bloqueado pra
-- não-super-admin; e mesmo o super admin lê via RPC `*_safe` que mascara os
-- valores (retorna só quais chaves existem). Writes via RPC security definer.
-- ============================================================================

create table if not exists public.platform_integrations (
  key text primary key,
  is_enabled boolean not null default false,
  environment text not null default 'sandbox'
    check (environment in ('sandbox', 'production')),
  config jsonb not null default '{}'::jsonb,
  secrets jsonb not null default '{}'::jsonb,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

insert into public.platform_integrations (key) values ('asaas')
on conflict (key) do nothing;

alter table public.platform_integrations enable row level security;

-- Só super admin lê/escreve. (Mesmo assim, o app lê via RPC safe que mascara.)
drop policy if exists platform_integrations_super_admin on public.platform_integrations;
create policy platform_integrations_super_admin on public.platform_integrations
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Trigger updated_at (reusa o padrão do touch existente, mas dedicado)
create or replace function public.touch_platform_integrations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_integrations_set_updated_at on public.platform_integrations;
create trigger platform_integrations_set_updated_at
  before update on public.platform_integrations
  for each row execute function public.touch_platform_integrations_updated_at();

-- ----------------------------------------------------------------------------
-- RPC safe: metadados sem expor os valores dos secrets.
-- ----------------------------------------------------------------------------
create or replace function public.get_platform_integration_safe(p_key text)
returns table (
  key text,
  is_enabled boolean,
  environment text,
  config jsonb,
  has_secret boolean,
  secret_keys text[],
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.key,
    i.is_enabled,
    i.environment,
    i.config,
    (jsonb_typeof(i.secrets) = 'object' and i.secrets <> '{}'::jsonb) as has_secret,
    (
      case
        when jsonb_typeof(i.secrets) = 'object'
        then (select coalesce(array_agg(k order by k), '{}'::text[]) from jsonb_object_keys(i.secrets) as k)
        else '{}'::text[]
      end
    ) as secret_keys,
    i.last_test_at, i.last_test_ok, i.last_test_message, i.updated_at
  from public.platform_integrations i
  where i.key = p_key
    and public.is_super_admin()
$$;

grant execute on function public.get_platform_integration_safe(text) to authenticated;

-- ----------------------------------------------------------------------------
-- RPC update: merge de secrets (preserva chaves não informadas) + metadados.
-- ----------------------------------------------------------------------------
create or replace function public.update_platform_integration(
  p_key text,
  p_is_enabled boolean,
  p_environment text,
  p_config jsonb,
  p_secrets_patch jsonb,
  p_last_test_ok boolean default null,
  p_last_test_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_secrets jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Apenas super admin pode editar integrações da plataforma';
  end if;

  insert into public.platform_integrations (key) values (p_key)
  on conflict (key) do nothing;

  select secrets into cur_secrets from public.platform_integrations where key = p_key;

  update public.platform_integrations
  set is_enabled = coalesce(p_is_enabled, is_enabled),
      environment = coalesce(p_environment, environment),
      config = coalesce(p_config, config),
      secrets = coalesce(cur_secrets, '{}'::jsonb) || coalesce(p_secrets_patch, '{}'::jsonb),
      last_test_ok = coalesce(p_last_test_ok, last_test_ok),
      last_test_message = coalesce(p_last_test_message, last_test_message),
      last_test_at = case when p_last_test_ok is not null then now() else last_test_at end,
      updated_by = auth.uid()
  where key = p_key;
end;
$$;

grant execute on function public.update_platform_integration(text, boolean, text, jsonb, jsonb, boolean, text)
  to authenticated;

-- Verificação --------------------------------------------------------------
select 'OK — migration 028 aplicada (platform_integrations + RPCs Asaas)' as status;
