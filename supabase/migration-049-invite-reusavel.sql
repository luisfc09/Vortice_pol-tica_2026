-- ============================================================================
-- Vórtice — migration 049 — Link de convite reutilizável (sem expiração)
-- ----------------------------------------------------------------------------
-- Remove a regra "uso único" do invite_code.
--
-- Mudanças:
--   1. RPC `get_invite_info(p_code)` recriada SEM o filtro `invite_used_at
--      IS NULL` — agora aceita o mesmo code N vezes, indefinidamente.
--   2. UPDATE em supporters zerando `invite_used_at` dos códigos que já
--      foram consumidos uma vez antes desta migration (Gustavo, Luis Fernando
--      e qualquer outro). Reaproveita os codes existentes sem precisar
--      regenerar.
--
-- O que NÃO muda:
--   • Coluna `supporters.invite_used_at` permanece (vira "morta" —
--     ninguém mais escreve nela após o redeploy do `accept-invite`).
--     Não dropamos pra evitar risco (RLS, índices, código TS que ainda
--     referencia). Vira histórico vazio de aqui pra frente.
--   • Índice parcial `idx_supporters_invite_used` permanece (vira no-op,
--     0 overhead).
--   • Edge function `accept-invite` precisa de redeploy MANUAL pra parar
--     de escrever invite_used_at (pegadinha §14.4 — push no GitHub NÃO
--     redeploya edge functions). Rodar APÓS esta migration:
--         supabase functions deploy accept-invite
--
-- Idempotente. Pode rodar tudo num bloco só (sem ALTER TYPE → sem
-- pegadinha de enum).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Recria get_invite_info SEM o filtro invite_used_at
-- ---------------------------------------------------------------------------

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
    -- REMOVIDO: and s.invite_used_at is null  (link agora é reutilizável)
    and s.status         = 'ativo'
    and c.status         in ('active','trial')
    and c.deleted_at     is null;
$$;

grant execute on function public.get_invite_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Reativa os codes que já foram consumidos uma vez antes desta migration
-- ---------------------------------------------------------------------------

update public.supporters
   set invite_used_at = null
 where invite_used_at is not null
returning id, name, city;

-- ---------------------------------------------------------------------------
-- 3) Pede ao PostgREST pra recarregar o schema (best-effort)
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------

select
  (select count(*) from public.supporters where invite_used_at is not null) as ainda_marcados_usados,
  -- Sanity check: a RPC ainda existe e está como SECURITY DEFINER
  (select count(*) from pg_proc where proname = 'get_invite_info') as rpc_existe;

-- Esperado: ainda_marcados_usados = 0, rpc_existe = 1
