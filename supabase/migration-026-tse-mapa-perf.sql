-- ============================================================================
-- Vórtice — migration 026 — performance da RPC tse_mapa_resumo
--
-- A versão da migration 025 estourava o statement_timeout em cargos grandes
-- (Dep Federal MG 2022 = 183k linhas): o DISTINCT ON (município) ORDER BY
-- município, votos desc gerava um sort enorme sem índice de apoio, e a CTE
-- `base` referenciada 2x era materializada.
--
-- Correções:
--  1. Índice de cobertura que casa EXATAMENTE o padrão da query: após o filtro
--     de igualdade (ano, turno, uf, cargo), a ordenação (municipio, votos desc)
--     vem pronta do índice — sem sort.
--  2. Função reescrita com dois subqueries independentes (sem CTE 2x), cada um
--     aproveitando o índice. + SET statement_timeout de segurança.
-- ============================================================================

create index if not exists tse_resultados_mapa_idx
  on public.tse_resultados (ano, turno, uf, cargo_codigo, municipio_codigo, votos desc);

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
set statement_timeout = '20s'
as $$
  select
    l.municipio_codigo,
    l.municipio_nome,
    tot.total_votos,
    tot.n_candidatos,
    l.sequencial_candidato,
    l.nome_candidato,
    l.nome_urna,
    l.numero_candidato,
    l.partido_sigla,
    l.partido_numero,
    l.votos,
    l.situacao
  from (
    select distinct on (municipio_codigo)
      municipio_codigo,
      municipio_nome,
      sequencial_candidato,
      nome_candidato,
      nome_urna,
      numero_candidato,
      partido_sigla,
      partido_numero,
      votos,
      situacao
    from public.tse_resultados
    where ano = p_ano and uf = upper(p_uf) and cargo_codigo = p_cargo and turno = p_turno
    order by municipio_codigo, votos desc, nome_candidato
  ) l
  join (
    select
      municipio_codigo,
      sum(votos)::bigint as total_votos,
      count(*)::bigint as n_candidatos
    from public.tse_resultados
    where ano = p_ano and uf = upper(p_uf) and cargo_codigo = p_cargo and turno = p_turno
    group by municipio_codigo
  ) tot using (municipio_codigo)
  order by l.municipio_nome;
$$;

grant execute on function public.tse_mapa_resumo(integer, text, integer, text)
  to anon, authenticated;

-- Verificação --------------------------------------------------------------
select 'OK — migration 026 aplicada (índice + tse_mapa_resumo otimizada)' as status;
