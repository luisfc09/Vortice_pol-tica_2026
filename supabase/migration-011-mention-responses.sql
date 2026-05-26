-- ============================================================================
-- Vórtice — migration 011 — Resposta Rápida
-- Registro de respostas geradas e aprovadas para menções negativas.
-- ============================================================================

create table if not exists public.mention_responses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  mention_id uuid references public.mentions (id) on delete set null,
  resposta_texto text not null,
  estilo text, -- 'DIRETA' | 'HUMANIZADA' | 'PROPOSITIVA' | custom
  editada boolean not null default false,
  aprovada_por uuid references auth.users (id),
  aprovada_at timestamptz not null default now(),
  publicada boolean not null default false,
  publicada_em text, -- 'X' | 'Instagram' | 'Facebook' | 'WhatsApp' etc.
  tempo_resposta_s integer, -- segundos entre menção e resposta
  analise jsonb, -- AnaliseMencao gerada no passo 2
  contexto jsonb, -- ContextoLegislativo do passo 3
  created_at timestamptz not null default now()
);

create index if not exists mention_responses_campaign_idx
  on public.mention_responses (campaign_id, created_at desc);
create index if not exists mention_responses_mention_idx
  on public.mention_responses (mention_id);

alter table public.mention_responses enable row level security;

drop policy if exists mention_responses_select on public.mention_responses;
create policy mention_responses_select on public.mention_responses
  for select using (
    public.is_super_admin()
    or campaign_id = public.current_campaign_id()
  );

drop policy if exists mention_responses_modify on public.mention_responses;
create policy mention_responses_modify on public.mention_responses
  for all using (
    public.is_super_admin()
    or (
      campaign_id = public.current_campaign_id()
      and public.current_user_role() in ('admin', 'coordinator', 'researcher')
    )
  )
  with check (
    public.is_super_admin()
    or (
      campaign_id = public.current_campaign_id()
      and public.current_user_role() in ('admin', 'coordinator', 'researcher')
    )
  );

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'mention_responses'
    )
    then 'OK — migration 011 aplicada'
    else 'FALHA'
  end as status;
