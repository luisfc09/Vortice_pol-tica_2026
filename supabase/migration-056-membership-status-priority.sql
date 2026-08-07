-- ============================================================================
-- Vórtice — migration 056 — get_my_membership() escolhe a campanha ÚTIL
--                            + fim da recursão no RLS de super_admins
--
-- BUG 1 (login travado)
-- ---------------------------------------------------------------------------
-- get_my_membership() (migration-035) ordenava as memberships só por
-- `cu.created_at asc` e devolvia a primeira. Quem tinha uma membership antiga
-- numa campanha `cancelled` E uma membership numa campanha ativa recebia a
-- CANCELADA — e o useAuth desloga à força quando a campanha vem cancelada.
-- Resultado: login impossível (senha e Google), mesmo com campanha boa.
--
-- Era o caso dos dois super admins (luisfc09@gmail.com e
-- sanjai.oliveira@gmail.com), ambos membros ativos da campanha cancelada
-- "Deputado Heleno do hospital".
--
-- FIX: ordenar por prioridade de status — active > trial > pending >
-- suspended > cancelled — e só então por created_at (desempate determinístico,
-- mesmo critério de current_campaign_id()/migration-027). A campanha cancelada
-- continua sendo devolvida quando é a ÚNICA que o usuário tem, porque o
-- useAuth precisa dela pra mostrar a mensagem certa.
--
-- Nada de RLS muda aqui: a função continua security definer devolvendo apenas
-- a membership do próprio auth.uid().
--
-- BUG 2 (recursão infinita no RLS)
-- ---------------------------------------------------------------------------
-- A policy super_admins_select (migration-004) consultava public.super_admins
-- dentro da própria policy de public.super_admins → qualquer SELECT direto na
-- tabela estourava "infinite recursion detected in policy for relation
-- super_admins" (42P17). Trocada por public.is_super_admin(), que é security
-- definer e portanto não reentra na policy.
--
-- BUG 3 (vazamento pequeno)
-- ---------------------------------------------------------------------------
-- list_super_admin_user_ids() ficou executável por `anon` (o Postgres concede
-- EXECUTE a PUBLIC por padrão em toda função nova). Qualquer um com a anon key
-- listava os UUIDs dos super admins. Revogado de PUBLIC/anon; segue disponível
-- para `authenticated`, que é quem a tela /usuarios usa.
-- ============================================================================

-- 1) get_my_membership() com prioridade de status ---------------------------
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
  order by
    case c.status
      when 'active'    then 0
      when 'trial'     then 1
      when 'pending'   then 2
      when 'suspended' then 3
      when 'cancelled' then 4
      else 5
    end,
    cu.created_at asc,
    cu.campaign_id asc
  limit 1
$$;

grant execute on function public.get_my_membership() to authenticated;

-- 2) super_admins: policy sem recursão --------------------------------------
drop policy if exists super_admins_select on public.super_admins;
create policy super_admins_select on public.super_admins
  for select using (public.is_super_admin());

-- 3) list_super_admin_user_ids(): fora do alcance do anon --------------------
revoke execute on function public.list_super_admin_user_ids() from public;
revoke execute on function public.list_super_admin_user_ids() from anon;
grant execute on function public.list_super_admin_user_ids() to authenticated;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when (
      select pg_get_functiondef(p.oid) like '%when ''cancelled'' then 4%'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'get_my_membership'
    )
    and exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'super_admins'
        and policyname = 'super_admins_select'
        and qual like '%is_super_admin%'
    )
    then 'OK — migration 056 aplicada (prioridade de status + policy sem recursão)'
    else 'FALHA'
  end as status;
