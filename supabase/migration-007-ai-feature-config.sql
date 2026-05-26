-- ============================================================================
-- Vórtice — migration 007
-- - Adiciona novos provedores LLM ao enum integration_type
-- - Cria ai_feature enum + tabela ai_feature_config (mapeia feature → integração)
-- ============================================================================

alter type integration_type add value if not exists 'openai';
alter type integration_type add value if not exists 'gemini';
alter type integration_type add value if not exists 'mistral';
alter type integration_type add value if not exists 'groq';
alter type integration_type add value if not exists 'xai';
alter type integration_type add value if not exists 'deepseek';

do $$ begin
  create type ai_feature as enum (
    'mention_sentiment',
    'mention_insights',
    'reply_suggestions'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.ai_feature_config (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  feature ai_feature not null,
  integration_id uuid references public.integrations (id) on delete set null,
  model text,
  options jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, feature)
);

create index if not exists ai_feature_config_campaign_idx
  on public.ai_feature_config (campaign_id);

alter table public.ai_feature_config enable row level security;

drop policy if exists ai_feature_config_select on public.ai_feature_config;
create policy ai_feature_config_select on public.ai_feature_config
  for select using (
    public.is_super_admin()
    or campaign_id = public.current_campaign_id()
  );

drop policy if exists ai_feature_config_modify on public.ai_feature_config;
create policy ai_feature_config_modify on public.ai_feature_config
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

-- Trigger para atualizar updated_at
create or replace function public.touch_ai_feature_config_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists ai_feature_config_set_updated_at on public.ai_feature_config;
create trigger ai_feature_config_set_updated_at
  before update on public.ai_feature_config
  for each row execute function public.touch_ai_feature_config_updated_at();

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'ai_feature_config'
    )
    then 'OK — migration 007 aplicada'
    else 'FALHA'
  end as status;
