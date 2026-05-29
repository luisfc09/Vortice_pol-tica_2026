-- ============================================================================
-- Vórtice — migration 035 — get_my_membership() (fix do /renovar)
--
-- BUG: cliente com campanha suspended/pending caía em /aguardando-ativacao
-- em vez de /renovar, porque current_campaign_id() só enxerga trial/active.
-- Logo o fetchMembership (sob RLS) não conseguia carregar a campanha.
--
-- FIX (Opção B — cirúrgico, ZERO mudança de política RLS):
-- Uma RPC security definer que devolve A PRÓPRIA membership do usuário
-- (auth.uid()) independente do STATUS da campanha — só exclui soft-deleted.
-- O frontend (useAuth.fetchMembership) passa a chamá-la em vez de ler a
-- tabela direto.
--
-- IMPORTANTE — o que esta migration NÃO faz (garantia de isolamento):
--   - NÃO altera current_campaign_id() → acesso a dados operacionais
--     (supporters, voters, field_interviews, mentions, etc.) segue cortado
--     para suspensos (retorna NULL → tabelas retornam vazio).
--   - NÃO altera nenhuma policy de campaigns/campaign_users nem das tabelas
--     operacionais.
--   - A função só devolve a campanha do PRÓPRIO auth.uid() (limit 1) →
--     impossível ler campanha de outro cliente.
--
-- Status: retorna cancelled também (de propósito) — o useAuth desloga
-- cancelled. Suspended/pending são mantidos para o ProtectedRoute mandar
-- pra /renovar. Soft-deleted é excluído (cai em /aguardando-ativacao).
-- ============================================================================

create or replace function public.get_my_membership()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'campaign', to_jsonb(c.*),
    'role', cu.role,
    'is_active', cu.is_active
  )
  from public.campaign_users cu
  join public.campaigns c on c.id = cu.campaign_id
  where cu.user_id = auth.uid()
    and cu.is_active = true
    and c.deleted_at is null
  order by cu.created_at asc, cu.campaign_id asc
  limit 1
$$;

grant execute on function public.get_my_membership() to authenticated;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'get_my_membership'
        and p.prosecdef = true
    )
    then 'OK migration 035 aplicada (get_my_membership, security definer)'
    else 'FALHA'
  end as status;
