-- ============================================================================
-- Vórtice — migration 047 — Convite descartável (Fase 2 da hierarquia)
-- ----------------------------------------------------------------------------
-- Adiciona em supporters:
--   • invite_used_at timestamptz nullable — quando o convite foi consumido.
--     NULL = código ainda ativo. Preenchido = código já foi usado por alguém.
--
-- Cria RPC pública `get_invite_info(p_code text)`:
--   • SECURITY DEFINER + STABLE
--   • Aceita o invite_code pela URL pública /convite/:code
--   • Devolve só campos NÃO sensíveis: nome do indicador, nome do candidato,
--     partido, número, plano, campaign_id. NÃO devolve telefone, email, etc.
--   • Retorna 0 linhas se code não existe OU já foi usado OU supporter
--     está inativo OU campanha foi excluída/suspensa.
--
-- Idempotente. NOTIFY pgrst no fim. ⚠ Após rodar, se /convite continuar
-- 404 no PostgREST cache, ver §14.4 das docs (restart server ou pg_terminate).
-- ============================================================================

alter table public.supporters
  add column if not exists invite_used_at timestamptz;

create index if not exists idx_supporters_invite_used
  on public.supporters (invite_used_at)
  where invite_used_at is null;

create or replace function public.get_invite_info(p_code text)
returns table (
  referrer_id     uuid,
  referrer_name   text,
  campaign_id     uuid,
  candidate_name  text,
  party           text,
  party_number    text,
  state           text,
  office          text,
  plan            text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id            as referrer_id,
    s.name          as referrer_name,
    c.id            as campaign_id,
    c.candidate_name,
    c.party,
    c.party_number,
    c.state,
    c.office,
    c.plan::text    as plan
  from public.supporters s
  join public.campaigns c on c.id = s.campaign_id
  where s.invite_code  = p_code
    and s.invite_used_at is null
    and s.status         = 'ativo'
    and c.status         in ('active','trial')
    and c.deleted_at     is null;
$$;

grant execute on function public.get_invite_info(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Verificação
select
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='supporters'
      and column_name='invite_used_at'
  ) as tem_coluna,
  exists(
    select 1 from pg_proc
    where proname='get_invite_info'
  ) as tem_rpc;
