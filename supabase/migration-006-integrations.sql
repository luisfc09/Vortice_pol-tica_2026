-- ============================================================================
-- Vórtice — migration 006
-- Integrações externas por campanha (Anthropic, X, Google News, Meta Ads etc.)
-- ============================================================================

do $$ begin
  create type integration_type as enum (
    'anthropic', 'twitter', 'google_news', 'meta_ads', 'google_ads', 'whatsapp'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  type integration_type not null,
  is_enabled boolean not null default false,
  -- config aberto (filtros, polling interval, etc.) — pode ser lido pelo client
  config jsonb not null default '{}'::jsonb,
  -- credenciais sensíveis (API keys, bearer tokens, secrets)
  secrets jsonb not null default '{}'::jsonb,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, type)
);

create index if not exists integrations_campaign_idx on public.integrations (campaign_id);

-- Trigger para atualizar updated_at
create or replace function public.touch_integrations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists integrations_set_updated_at on public.integrations;
create trigger integrations_set_updated_at
  before update on public.integrations
  for each row execute function public.touch_integrations_updated_at();

alter table public.integrations enable row level security;

-- Admin e coordenador da campanha podem ler/escrever — sem expor secrets para outros roles
drop policy if exists integrations_select on public.integrations;
create policy integrations_select on public.integrations
  for select using (
    public.is_super_admin()
    or (
      campaign_id = public.current_campaign_id()
      and public.current_user_role() in ('admin', 'coordinator')
    )
  );

drop policy if exists integrations_modify on public.integrations;
create policy integrations_modify on public.integrations
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

-- RPC helper: retorna integrações da campanha atual mascarando secrets
-- (mostra apenas se os campos existem, não os valores).
create or replace function public.list_integrations_safe()
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
  select
    i.id, i.type, i.is_enabled, i.config,
    (jsonb_typeof(i.secrets) = 'object' and i.secrets != '{}'::jsonb) as has_secret,
    (
      case
        when jsonb_typeof(i.secrets) = 'object'
        then (select coalesce(array_agg(key order by key), '{}'::text[]) from jsonb_object_keys(i.secrets) as key)
        else '{}'::text[]
      end
    ) as secret_keys,
    i.last_test_at, i.last_test_ok, i.last_test_message, i.updated_at
  from public.integrations i
  where i.campaign_id = public.current_campaign_id()
$$;

grant execute on function public.list_integrations_safe() to authenticated;

-- update_integration: aplica patch de secrets (preserva chaves antigas que
-- não foram informadas) + atualiza config e is_enabled.
create or replace function public.update_integration(
  p_id uuid,
  p_is_enabled boolean,
  p_config jsonb,
  p_secrets_patch jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  cur_secrets jsonb;
  new_secrets jsonb;
  cur_campaign uuid;
begin
  select campaign_id, secrets into cur_campaign, cur_secrets
  from public.integrations where id = p_id;
  if cur_campaign is null then
    raise exception 'Integração não encontrada';
  end if;

  -- Autorização: precisa ser super admin OU admin/coordenador da campanha atual
  if not (
    public.is_super_admin()
    or (
      cur_campaign = public.current_campaign_id()
      and public.current_user_role() in ('admin', 'coordinator')
    )
  ) then
    raise exception 'Sem permissão para editar esta integração';
  end if;

  new_secrets := coalesce(cur_secrets, '{}'::jsonb) || coalesce(p_secrets_patch, '{}'::jsonb);

  update public.integrations
  set is_enabled = p_is_enabled,
      config = coalesce(p_config, config),
      secrets = new_secrets
  where id = p_id;
end;
$$;

grant execute on function public.update_integration(uuid, boolean, jsonb, jsonb) to authenticated;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'integrations'
    )
    then 'OK — migration 006 aplicada'
    else 'FALHA'
  end as status;
