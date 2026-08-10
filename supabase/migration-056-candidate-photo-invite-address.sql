-- ============================================================================
-- Vórtice — migration 056 — Foto do candidato no convite
-- ----------------------------------------------------------------------------
-- CONTEXTO: a página pública /convite/[code] deve exibir uma FOTO do candidato
-- (rosto), separada do logo/brand da campanha (brand_logo_url). Como não havia
-- coluna dedicada, criamos `campaigns.candidate_photo_url` e passamos a
-- retornar esse campo no RPC público `get_invite_info`.
--
-- O QUE ESTA MIGRATION FAZ:
--   1. ALTER TABLE campaigns → adiciona candidate_photo_url text (nullable).
--   2. Recria get_invite_info(p_code) adicionando candidate_photo_url ao
--      retorno. Como o TIPO DE RETORNO muda (nova coluna na RETURNS TABLE),
--      o Postgres NÃO permite CREATE OR REPLACE — é preciso DROP + CREATE.
--
-- O QUE NÃO MUDA:
--   • Endereço do apoiador (cep, logradouro, numero, complemento, neighborhood)
--     JÁ existe em supporters — nenhuma coluna nova. A coleta passa a ser feita
--     no form do convite + persistida pela edge `accept-invite` (redeploy).
--   • brand_logo_url continua sendo o logo/identidade (tela Branding). A foto
--     do candidato é um upload NOVO e independente.
--
-- ⚠️ Edge function `accept-invite` precisa de redeploy MANUAL depois (grava os
--    campos de endereço). Push no GitHub NÃO redeploya edge functions:
--        supabase functions deploy accept-invite
--
-- Idempotente. Sem ALTER TYPE de enum → sem pegadinha de enum.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Coluna da foto do candidato
-- ---------------------------------------------------------------------------

alter table public.campaigns
  add column if not exists candidate_photo_url text;

-- ---------------------------------------------------------------------------
-- 2) Recria get_invite_info retornando candidate_photo_url
--    (DROP obrigatório: mudança no tipo de retorno da função)
-- ---------------------------------------------------------------------------

drop function if exists public.get_invite_info(text);

create function public.get_invite_info(p_code text)
returns table (
  referrer_id          uuid,
  referrer_name        text,
  campaign_id          uuid,
  candidate_name       text,
  party                text,
  party_number         text,
  state                text,
  office               text,
  plan                 text,
  candidate_photo_url  text
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
    c.plan::text    as plan,
    c.candidate_photo_url
  from public.supporters s
  join public.campaigns c on c.id = s.campaign_id
  where s.invite_code  = p_code
    and s.status         = 'ativo'
    and c.status         in ('active','trial')
    and c.deleted_at     is null;
$$;

grant execute on function public.get_invite_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Recarrega o schema do PostgREST (best-effort)
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------

select
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='campaigns'
       and column_name='candidate_photo_url')                      as coluna_foto_existe,
  (select count(*) from pg_proc where proname='get_invite_info')   as rpc_existe;

-- Esperado: coluna_foto_existe = 1, rpc_existe = 1
