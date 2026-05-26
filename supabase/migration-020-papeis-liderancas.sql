-- ============================================================================
-- Vórtice — migration 020 — Expansão dos papéis de Lideranças
--
-- O enum supporter_role_type passa de 4 → 23+ valores. Cobre:
--   - cargos políticos (prefeito, vereador, …)
--   - cargos da campanha (coord. geral / político / jurídico / financeiro /
--     marketing / mobilização / regional / local)
--   - cargos de gabinete (chefe / assessor / secretário / procurador)
--   - papéis de base (líder, cabo, militante, apoiador, eleitor)
--   - 'outro' com campo livre em supporters.role_custom
--
-- Postgres não permite DROP VALUE em enum. Os valores antigos
-- ('lider', 'cabo', 'militante', 'apoiador') ficam no enum — só
-- mudamos o que aparece na UI.
--
-- Por exigência do Postgres, ADD VALUE precisa de COMMIT antes de
-- poder ser usado. Não é problema aqui — frontend só passa a usar
-- depois que essa migration rodar.
-- ============================================================================

-- 1. Cargos políticos
alter type supporter_role_type add value if not exists 'prefeito';
alter type supporter_role_type add value if not exists 'vice_prefeito';
alter type supporter_role_type add value if not exists 'vereador';

-- 2. Cargos da campanha (administrativos)
alter type supporter_role_type add value if not exists 'administrador';
alter type supporter_role_type add value if not exists 'candidato';
alter type supporter_role_type add value if not exists 'coord_geral';
alter type supporter_role_type add value if not exists 'coord_politico';
alter type supporter_role_type add value if not exists 'coord_juridico';
alter type supporter_role_type add value if not exists 'coord_financeiro';
alter type supporter_role_type add value if not exists 'coord_marketing';
alter type supporter_role_type add value if not exists 'coord_mobilizacao';
alter type supporter_role_type add value if not exists 'coord_regional';
alter type supporter_role_type add value if not exists 'coord_local';

-- 3. Gabinete
alter type supporter_role_type add value if not exists 'chefe_gabinete';
alter type supporter_role_type add value if not exists 'assessor_gabinete';
alter type supporter_role_type add value if not exists 'secretario';
alter type supporter_role_type add value if not exists 'procurador';

-- 4. Pesquisa e base
alter type supporter_role_type add value if not exists 'pesquisador';
alter type supporter_role_type add value if not exists 'cabo_eleitoral';  -- alias verboso de 'cabo'
alter type supporter_role_type add value if not exists 'lideranca';        -- alias verboso de 'lider'
alter type supporter_role_type add value if not exists 'eleitor';
alter type supporter_role_type add value if not exists 'outro';

-- 5. Coluna pra capturar texto livre quando role = 'outro'.
alter table public.supporters
  add column if not exists role_custom text;

-- Verificação --------------------------------------------------------------
select
  case
    when (
      select count(*) from pg_enum
      where enumtypid = 'supporter_role_type'::regtype
        and enumlabel in (
          'prefeito','vice_prefeito','vereador',
          'administrador','candidato',
          'coord_geral','coord_politico','coord_juridico','coord_financeiro',
          'coord_marketing','coord_mobilizacao','coord_regional','coord_local',
          'chefe_gabinete','assessor_gabinete','secretario','procurador',
          'pesquisador','cabo_eleitoral','lideranca','eleitor','outro'
        )
    ) >= 22
    and exists (
      select 1 from information_schema.columns
      where table_name = 'supporters' and column_name = 'role_custom'
    )
    then 'OK — migration 020 aplicada (papéis expandidos + role_custom)'
    else 'FALHA — confira pg_enum e supporters.role_custom'
  end as status;
