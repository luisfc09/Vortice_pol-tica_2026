-- ============================================================================
-- Vórtice — migration 023 — Tabela tse_resultados
--
-- Guarda dados eleitorais oficiais do TSE, importados via backend/src/import.
-- Granularidade: candidato × município (votos somados das zonas). Pra cada
-- combinação (ano, turno, uf, municipio, cargo, sequencial_candidato) há
-- exatamente UMA linha.
--
-- Dados são públicos — RLS abre SELECT pra anon. INSERT/UPDATE/DELETE só pelo
-- service-role (backend importer).
-- ============================================================================

create table if not exists public.tse_resultados (
  id uuid primary key default gen_random_uuid(),
  ano integer not null,
  turno integer not null default 1,
  uf text not null,
  municipio_codigo text not null,
  municipio_nome text not null,
  cargo_codigo text not null,
  cargo_label text,
  numero_candidato text not null,
  nome_candidato text not null,
  nome_urna text,
  sequencial_candidato text not null,
  partido_sigla text,
  partido_numero text,
  coligacao text,
  situacao text,                -- 'eleito', 'nao_eleito', 'suplente', etc.
  votos integer not null default 0,
  imported_at timestamptz not null default now(),

  -- Unicidade: re-importação substitui em vez de duplicar
  constraint tse_resultados_unique unique
    (ano, turno, uf, municipio_codigo, cargo_codigo, sequencial_candidato)
);

-- Índices pros padrões de query mais comuns
create index if not exists tse_resultados_uf_ano_cargo_municipio_idx
  on public.tse_resultados (uf, ano, cargo_codigo, municipio_codigo);

create index if not exists tse_resultados_uf_ano_cargo_votos_idx
  on public.tse_resultados (uf, ano, cargo_codigo, votos desc);

create index if not exists tse_resultados_nome_candidato_idx
  on public.tse_resultados (uf, ano, lower(nome_candidato));

create index if not exists tse_resultados_partido_idx
  on public.tse_resultados (uf, ano, cargo_codigo, partido_sigla);

-- RLS: leitura pública (são dados oficiais)
alter table public.tse_resultados enable row level security;

drop policy if exists tse_resultados_select on public.tse_resultados;
create policy tse_resultados_select on public.tse_resultados
  for select using (true);

-- Writes só via service-role (sem policy de insert/update/delete = bloqueado
-- pra anon/authenticated, mas service-role bypassa RLS por padrão)

-- Verificação --------------------------------------------------------------
select
  case
    when exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'tse_resultados'
    )
    then 'OK — migration 023 aplicada (tabela tse_resultados pronta)'
    else 'FALHA'
  end as status;
