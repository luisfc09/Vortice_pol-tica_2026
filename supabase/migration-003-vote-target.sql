-- ============================================================================
-- Vórtice — migration 003
-- Adiciona meta de votos por campanha + slogan/tagline opcional.
-- Rode no SQL Editor após migration-002-provisioning.sql.
-- ============================================================================

alter table campaigns
  add column if not exists vote_target int not null default 0;

alter table campaigns
  add column if not exists slogan text;

-- Verificação
select
  case
    when exists (
      select 1 from information_schema.columns
      where table_name = 'campaigns' and column_name = 'vote_target'
    )
    then 'OK — vote_target adicionado'
    else 'FALHA'
  end as status;
