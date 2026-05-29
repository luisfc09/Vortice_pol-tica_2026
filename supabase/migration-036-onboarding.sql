-- ============================================================================
-- Vórtice — migration 036 — Onboarding guiado + municípios-alvo
--
-- - campaigns.onboarding_completed: controla o CTA do wizard no Dashboard.
-- - campaigns.target_municipalities: códigos IBGE dos municípios-alvo (array).
--
-- Campanhas JÁ existentes são "grandfathered" (onboarding_completed = true),
-- pra não mostrarem o wizard. Novas campanhas nascem com false (default) e
-- veem o CTA. Idempotente.
-- ============================================================================

alter table public.campaigns
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists target_municipalities text[];

-- Grandfather: campanhas existentes não precisam do wizard.
update public.campaigns
  set onboarding_completed = true
  where onboarding_completed = false;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when (
      select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'campaigns'
        and column_name in ('onboarding_completed', 'target_municipalities')
    ) = 2
    then 'OK migration 036 aplicada (onboarding + municipios-alvo)'
    else 'FALHA'
  end as status;
