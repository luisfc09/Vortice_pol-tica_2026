-- ============================================================================
-- Vórtice — migration 021 — Planos de campanha (Básico / Intermediário / TOP)
--
-- Cria o enum campaign_plan e adiciona a coluna `plan` na tabela campaigns.
-- Por enquanto todos os planos têm acesso aos mesmos módulos (exceto a
-- área Admin Vórtice). A diferenciação fica no roadmap: features de IA,
-- limites de entrevistas, etc.
-- ============================================================================

do $$ begin
  create type campaign_plan as enum ('basico', 'intermediario', 'top');
exception when duplicate_object then null; end $$;

alter table public.campaigns
  add column if not exists plan campaign_plan not null default 'basico';

-- Verificação --------------------------------------------------------------
select
  case
    when exists (
      select 1 from information_schema.columns
      where table_name = 'campaigns' and column_name = 'plan'
    )
    then 'OK — migration 021 aplicada (campaigns.plan)'
    else 'FALHA'
  end as status;
