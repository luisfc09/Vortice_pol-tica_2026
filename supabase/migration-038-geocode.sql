-- ============================================================
-- Vórtice — migration-038 — georreferenciamento (geo_source + cache de CEP)
--
-- - voters.geo_source: origem das coordenadas (NULL=sem coords, 'gps',
--   'address', 'manual').
-- - geocode_cache: cache de geocodificação por CEP (compartilhado entre
--   campanhas — só lat/lng de CEP, sem dado sensível) para evitar repetir
--   chamadas ao Nominatim.
-- ============================================================

-- 1) Coluna geo_source em voters
alter table public.voters
  add column if not exists geo_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'voters_geo_source_check'
  ) then
    alter table public.voters
      add constraint voters_geo_source_check
      check (geo_source is null or geo_source in ('gps','address','manual'));
  end if;
end $$;

-- 2) Cache de geocodificação por CEP
create table if not exists public.geocode_cache (
  cep        text primary key,
  lat        double precision not null,
  lng        double precision not null,
  created_at timestamptz not null default now()
);

alter table public.geocode_cache enable row level security;

-- Cache é dado público (coordenadas de CEP) — qualquer autenticado lê/grava.
drop policy if exists "geocode_cache_select" on public.geocode_cache;
create policy "geocode_cache_select"
  on public.geocode_cache for select
  to authenticated
  using (true);

drop policy if exists "geocode_cache_insert" on public.geocode_cache;
create policy "geocode_cache_insert"
  on public.geocode_cache for insert
  to authenticated
  with check (true);

grant select, insert on public.geocode_cache to authenticated;

-- 3) Verificação
select
  (select count(*) from information_schema.columns
     where table_name = 'voters' and column_name = 'geo_source') as has_geo_source,
  (select count(*) from information_schema.tables
     where table_name = 'geocode_cache') as has_geocode_cache;
-- esperado: has_geo_source = 1, has_geocode_cache = 1
