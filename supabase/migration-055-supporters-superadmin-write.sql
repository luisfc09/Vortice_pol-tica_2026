-- ============================================================================
-- Vórtice — migration 055 — Super admin escreve em supporters (view-as)
--
-- PROBLEMA: a migration-005 deu ao super admin escape de is_super_admin() só
-- pra SELECT em supporters (por isso ele VÊ lideranças de qualquer campanha).
-- Mas não há escape pra INSERT/UPDATE/DELETE. Como current_campaign_id()
-- retorna sempre a PRIMEIRA campanha que o super admin é membro (não a que ele
-- está vendo por view-as), qualquer escrita numa campanha que ele não é membro
-- é bloqueada pela RLS.
--
-- Efeito visível: ao entrar (view-as) numa campanha que ele criou/não é membro
-- e clicar "Convidar Liderança", o ensure() falha ao inserir o supporter do
-- próprio super admin (pra gerar o invite_code) → o modal não abre.
--
-- CORREÇÃO: escape de is_super_admin() pra INSERT/UPDATE/DELETE em supporters,
-- coerente com o god-mode de leitura que ele já tem. Assim o super admin
-- gerencia lideranças em qualquer campanha que enxerga.
--
-- Idempotente. As policies convivem (OR) com as por-campanha existentes.
-- ============================================================================

drop policy if exists supporters_super_admin_insert on public.supporters;
create policy supporters_super_admin_insert on public.supporters
  for insert with check (public.is_super_admin());

drop policy if exists supporters_super_admin_update on public.supporters;
create policy supporters_super_admin_update on public.supporters
  for update using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists supporters_super_admin_delete on public.supporters;
create policy supporters_super_admin_delete on public.supporters
  for delete using (public.is_super_admin());

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (select 1 from pg_policies
                 where schemaname='public' and tablename='supporters'
                   and policyname='supporters_super_admin_insert')
     and exists (select 1 from pg_policies
                 where schemaname='public' and tablename='supporters'
                   and policyname='supporters_super_admin_update')
     and exists (select 1 from pg_policies
                 where schemaname='public' and tablename='supporters'
                   and policyname='supporters_super_admin_delete')
    then 'OK migration 055 aplicada (super admin escreve em supporters)'
    else 'FALHA'
  end as status;
