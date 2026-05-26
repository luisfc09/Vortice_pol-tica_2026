-- ============================================================================
-- Vórtice — migration 014 — Endereço estruturado em supporters/voters
--
-- Substitui o campo livre `city` por endereço estruturado:
--   cep, logradouro, numero, complemento
-- O `municipality_code` continua sendo a chave de localização política
-- (popula a cidade canônica). O `city` legado fica como nullable só pra
-- não quebrar inserts antigos.
-- ============================================================================

-- supporters --------------------------------------------------------------

alter table supporters
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text;

alter table supporters
  alter column city drop not null;

create index if not exists supporters_cep_idx on supporters (cep);

-- voters ------------------------------------------------------------------

alter table voters
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists neighborhood text;

alter table voters
  alter column city drop not null;

create index if not exists voters_cep_idx on voters (cep);

-- Verificação -------------------------------------------------------------

select
  case
    when (
      select count(*) from information_schema.columns
      where table_name = 'supporters'
        and column_name in ('cep', 'logradouro', 'numero', 'complemento')
    ) = 4
    and (
      select count(*) from information_schema.columns
      where table_name = 'voters'
        and column_name in ('cep', 'logradouro', 'numero', 'complemento', 'neighborhood')
    ) = 5
    then 'OK — migration 014 aplicada'
    else 'FALHA'
  end as status;
