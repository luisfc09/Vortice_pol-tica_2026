-- ============================================================================
-- Vórtice — migration 037 — Faixa etária no cadastro de eleitor
--
-- Adiciona voters.age_range (mesmo enum das entrevistas) pra habilitar o
-- filtro de faixa etária na listagem de Eleitores. Nullable (cadastros
-- existentes ficam "não informado"). Idempotente.
-- ============================================================================

alter table public.voters
  add column if not exists age_range text;

-- Domínio fechado (NULL é permitido pela check).
do $$ begin
  alter table public.voters
    add constraint voters_age_range_check
    check (age_range in ('16-24', '25-34', '35-44', '45-59', '60+'));
exception when duplicate_object then null; end $$;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'voters' and column_name = 'age_range'
    )
    then 'OK migration 037 aplicada (voters.age_range)'
    else 'FALHA'
  end as status;
