-- ============================================================================
-- Vórtice — migration 027 — current_campaign_id() determinística
--
-- A versão anterior usava `limit 1` SEM `order by` — se um usuário comum for
-- membro de 2+ campanhas (raro hoje, mas possível no futuro), o Postgres
-- escolheria uma de forma NÃO determinística, fazendo o usuário ver uma
-- campanha imprevisível.
--
-- Correção: ordena pela membership mais antiga (created_at asc) — sempre a
-- mesma campanha. Mantém os filtros de is_active + campanha ativa/trial.
--
-- (O escopo de dados em si já é reforçado na camada de app, que filtra por
-- campaign_id = campanha efetiva. Esta migration só torna o fallback do RLS
-- estável.)
-- ============================================================================

create or replace function public.current_campaign_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cu.campaign_id
  from public.campaign_users cu
  join public.campaigns c on c.id = cu.campaign_id
  where cu.user_id = auth.uid()
    and cu.is_active = true
    and c.status in ('trial', 'active')
  order by cu.created_at asc, cu.campaign_id asc
  limit 1
$$;

-- Verificação --------------------------------------------------------------
select 'OK — migration 027 aplicada (current_campaign_id determinística)' as status;
