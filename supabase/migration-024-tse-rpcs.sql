-- ============================================================================
-- Vórtice — migration 024 — RPCs de agregação pra tse_resultados
--
-- Por que: a tabela tse_resultados tem granularidade candidato × município.
-- Pra obter (a) o total de votos de um candidato no estado inteiro ou
-- (b) a lista de (ano, turno, cargo) disponíveis, é preciso somar/agrupar
-- MUITAS linhas (183k+ pra dep federal). Fazer isso no backend (puxar tudo
-- e somar em memória) esbarra no limite de linhas do PostgREST (~1000 por
-- resposta) e dá resultado parcial/errado. Estas funções agregam no banco.
--
-- Ambas são STABLE e SECURITY INVOKER (RLS aplicada normalmente — a tabela
-- tem SELECT público, então funcionam com anon).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- tse_candidatos_agregados — ranking estadual por candidato (soma de votos
-- de todos os municípios). Filtros opcionais por cargo, turno, nome, número,
-- partido. Ordena por votos desc.
-- ----------------------------------------------------------------------------
create or replace function public.tse_candidatos_agregados(
  p_ano integer,
  p_uf text,
  p_cargo text default null,
  p_turno integer default 1,
  p_nome text default null,
  p_numero text default null,
  p_partido text default null,
  p_limit integer default 500
)
returns table (
  sequencial_candidato text,
  nome_candidato text,
  nome_urna text,
  numero_candidato text,
  partido_sigla text,
  partido_numero text,
  situacao text,
  cargo_codigo text,
  votos bigint,
  municipios bigint
)
language sql
stable
as $$
  select
    t.sequencial_candidato,
    max(t.nome_candidato)        as nome_candidato,
    max(t.nome_urna)             as nome_urna,
    max(t.numero_candidato)      as numero_candidato,
    max(t.partido_sigla)         as partido_sigla,
    max(t.partido_numero)        as partido_numero,
    max(t.situacao)              as situacao,
    max(t.cargo_codigo)          as cargo_codigo,
    sum(t.votos)::bigint         as votos,
    count(distinct t.municipio_codigo)::bigint as municipios
  from public.tse_resultados t
  where t.ano = p_ano
    and t.uf = upper(p_uf)
    and t.turno = p_turno
    and (p_cargo   is null or t.cargo_codigo = p_cargo)
    and (p_partido is null or t.partido_sigla = upper(p_partido))
    and (p_numero  is null or t.numero_candidato = p_numero)
    and (p_nome    is null or t.nome_candidato ilike '%' || p_nome || '%')
  group by t.sequencial_candidato
  order by sum(t.votos) desc
  limit greatest(1, least(coalesce(p_limit, 500), 2000));
$$;

-- ----------------------------------------------------------------------------
-- tse_combinacoes — distintas (ano, turno, uf, cargo) presentes na base,
-- com contagem de linhas. Pro frontend montar dropdowns sem hardcodar.
-- ----------------------------------------------------------------------------
create or replace function public.tse_combinacoes()
returns table (
  ano integer,
  turno integer,
  uf text,
  cargo_codigo text,
  linhas bigint,
  municipios bigint
)
language sql
stable
as $$
  select
    t.ano,
    t.turno,
    t.uf,
    t.cargo_codigo,
    count(*)::bigint as linhas,
    count(distinct t.municipio_codigo)::bigint as municipios
  from public.tse_resultados t
  group by t.ano, t.turno, t.uf, t.cargo_codigo
  order by t.ano desc, t.uf, t.cargo_codigo, t.turno;
$$;

-- Permissões: anon e authenticated podem executar (dados públicos)
grant execute on function public.tse_candidatos_agregados(
  integer, text, text, integer, text, text, text, integer
) to anon, authenticated;
grant execute on function public.tse_combinacoes() to anon, authenticated;

-- Verificação --------------------------------------------------------------
select 'OK — migration 024 aplicada (RPCs tse_candidatos_agregados + tse_combinacoes)' as status;
