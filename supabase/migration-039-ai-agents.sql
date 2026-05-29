-- ============================================================
-- Vórtice — migration-039 — agentes de IA (config por campanha + histórico)
--
-- - ai_agents: config dos agentes (steve/carlos) por campanha — nome, foto,
--   ativo, LLM preferido (null = automático).
-- - agent_conversations: histórico do Steve, visível APENAS ao próprio usuário
--   (super admin vê tudo). Carlos não persiste.
-- ============================================================

create table if not exists public.ai_agents (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  agent_key    text not null check (agent_key in ('steve','carlos')),
  name         text not null default 'Steve_AI',
  avatar_url   text,
  is_active    boolean not null default true,
  llm_provider text check (llm_provider in ('anthropic','openai')),  -- null = automático
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (campaign_id, agent_key)
);

create table if not exists public.agent_conversations (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  agent_key    text not null default 'steve',
  user_id      uuid references auth.users(id) on delete set null,
  title        text,
  messages     jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_agent_conversations_user
  on public.agent_conversations (campaign_id, agent_key, user_id, updated_at desc);

alter table public.ai_agents enable row level security;
alter table public.agent_conversations enable row level security;

-- ai_agents: config compartilhada da campanha (admin/coordenador acessam via app)
drop policy if exists agents_campaign on public.ai_agents;
create policy agents_campaign on public.ai_agents
  for all
  using  (is_super_admin() or campaign_id = current_campaign_id())
  with check (is_super_admin() or campaign_id = current_campaign_id());

-- agent_conversations: cada usuário só vê/edita as PRÓPRIAS conversas
drop policy if exists conversations_campaign on public.agent_conversations;
drop policy if exists conversations_own on public.agent_conversations;
create policy conversations_own on public.agent_conversations
  for all
  using  (is_super_admin() or (campaign_id = current_campaign_id() and user_id = auth.uid()))
  with check (is_super_admin() or (campaign_id = current_campaign_id() and user_id = auth.uid()));

grant select, insert, update, delete on public.ai_agents to authenticated;
grant select, insert, update, delete on public.agent_conversations to authenticated;

-- Verificação
select
  (select count(*) from information_schema.tables where table_name = 'ai_agents')           as has_ai_agents,
  (select count(*) from information_schema.tables where table_name = 'agent_conversations') as has_agent_conversations;
-- esperado: 1 e 1
