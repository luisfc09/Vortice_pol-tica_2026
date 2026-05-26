-- ============================================================================
-- Vórtice — migration 019 — Inteligência Eleitoral por IA
--
-- Tabela que guarda o resultado de cada rodada de análise estatística +
-- IA. Cada linha é um snapshot — o histórico fica disponível pra comparar
-- evolução semana a semana.
--
-- Trigger de criação:
--   1. Manualmente via botão "Atualizar análise" no Painel Estratégico
--   2. A cada múltiplo de 50 entrevistas completas (frontend dispara)
--   3. Agendado (cron / Edge Function — opcional, futuro)
-- ============================================================================

create table if not exists public.campaign_intelligence (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  generated_at timestamptz not null default now(),
  total_interviews integer not null default 0,

  -- Distribuições estatísticas (calculadas localmente antes de chamar a IA)
  vote_intention_dist jsonb,
  age_dist            jsonb,
  gender_dist         jsonb,
  religion_dist       jsonb,
  income_dist         jsonb,
  education_dist      jsonb,

  -- Cruzamentos estratégicos
  crossings           jsonb,

  -- Temas
  themes_ranking      jsonb,
  themes_by_region    jsonb,
  themes_by_profile   jsonb,

  -- Avaliações de governo (médias 1-5)
  gov_ratings         jsonb,

  -- Sentimento das respostas abertas (por tema)
  sentiment_analysis  jsonb,

  -- Saída da IA (cada um é uma estrutura conforme o frontend espera)
  resumo_executivo       text,
  strategic_insights     jsonb,
  risk_alerts            jsonb,
  opportunities          jsonb,
  recommended_actions    jsonb,
  segments_to_convert    jsonb,
  segments_at_risk       jsonb,
  mensagens_por_segmento jsonb,
  comparacao_institutos  jsonb,

  -- Scores
  conversion_probability numeric(5,2),
  campaign_health_score  integer,

  -- Resposta crua da IA (pra debug / auditoria)
  raw_analysis text
);

create index if not exists campaign_intelligence_campaign_idx
  on public.campaign_intelligence (campaign_id, generated_at desc);

-- RLS --------------------------------------------------------------------
alter table public.campaign_intelligence enable row level security;

drop policy if exists campaign_intelligence_select on public.campaign_intelligence;
create policy campaign_intelligence_select on public.campaign_intelligence
  for select using (campaign_id = public.current_campaign_id());

drop policy if exists campaign_intelligence_insert on public.campaign_intelligence;
create policy campaign_intelligence_insert on public.campaign_intelligence
  for insert with check (campaign_id = public.current_campaign_id());

drop policy if exists campaign_intelligence_delete on public.campaign_intelligence;
create policy campaign_intelligence_delete on public.campaign_intelligence
  for delete using (campaign_id = public.current_campaign_id());

-- Verificação ------------------------------------------------------------
select
  case
    when exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'campaign_intelligence'
    )
    and (
      select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'campaign_intelligence'
    ) >= 3
    then 'OK — migration 019 aplicada (campaign_intelligence + RLS)'
    else 'FALHA'
  end as status;
