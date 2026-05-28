-- ============================================================================
-- Vórtice — migration 025 — RPC tse_mapa_resumo
--
-- Pro choropleth do Mapa político: pra uma eleição (ano, cargo, turno),
-- devolve UMA linha por município com:
--   - total de votos e nº de candidatos no município
--   - o candidato LÍDER (mais votado) ali: nome, partido, votos, situação
--
-- É o que o mapa precisa pra colorir cada município pela cor do partido
-- líder e mostrar o tooltip. Tudo agregado no banco (DISTINCT ON + CTE),
-- então o frontend faz 1 request e recebe os ~853 municípios prontos.
--
-- STABLE + SECURITY INVOKER (RLS aplicada; tse_resultados tem SELECT público).
-- ============================================================================

create or replace function public.tse_mapa_resumo(
  p_ano integer,
  p_cargo text,
  p_turno integer default 1,
  p_uf text default 'MG'
)
returns table (
  municipio_codigo text,
  municipio_nome text,
  total_votos bigint,
  n_candidatos bigint,
  lider_sequencial text,
  lider_nome text,
  lider_urna text,
  lider_numero text,
  lider_partido text,
  lider_partido_numero text,
  lider_votos integer,
  lider_situacao text
)
language sql
stable
as $$
  with base as (
    select *
    from public.tse_resultados
    where ano = p_ano
      and uf = upper(p_uf)
      and cargo_codigo = p_cargo
      and turno = p_turno
  ),
  tot as (
    select
      municipio_codigo,
      max(municipio_nome)    as municipio_nome,
      sum(votos)::bigint     as total_votos,
      count(*)::bigint       as n_candidatos
    from base
    group by municipio_codigo
  ),
  lider as (
    select distinct on (municipio_codigo)
      municipio_codigo,
      sequencial_candidato,
      nome_candidato,
      nome_urna,
      numero_candidato,
      partido_sigla,
      partido_numero,
      votos,
      situacao
    from base
    order by municipio_codigo, votos desc, nome_candidato
  )
  select
    t.municipio_codigo,
    t.municipio_nome,
    t.total_votos,
    t.n_candidatos,
    l.sequencial_candidato,
    l.nome_candidato,
    l.nome_urna,
    l.numero_candidato,
    l.partido_sigla,
    l.partido_numero,
    l.votos,
    l.situacao
  from tot t
  join lider l using (municipio_codigo)
  order by t.municipio_nome;
$$;

grant execute on function public.tse_mapa_resumo(integer, text, integer, text)
  to anon, authenticated;

-- Verificação --------------------------------------------------------------
select 'OK — migration 025 aplicada (RPC tse_mapa_resumo)' as status;
