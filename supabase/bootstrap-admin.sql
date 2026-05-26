-- ============================================================================
-- Vórtice — promover o primeiro admin
-- Rode DEPOIS de:
--   1. Você ter feito login com Google pela primeira vez no /login
--      (isso cria seu auth.user automaticamente)
--   2. Ter rodado migration-002-provisioning.sql
--
-- Pega o user mais recente que ainda não tem campaign_users e o liga
-- como admin da campanha existente. Se houver mais de uma campanha, edite
-- o where da subquery `target_campaign`.
-- ============================================================================

with
  target_user as (
    select u.id, u.email
    from auth.users u
    where not exists (
      select 1 from public.campaign_users cu where cu.user_id = u.id
    )
    order by u.created_at desc
    limit 1
  ),
  target_campaign as (
    select id
    from public.campaigns
    order by created_at desc
    limit 1
  ),
  link as (
    insert into public.campaign_users (campaign_id, user_id, role, is_active)
    select target_campaign.id, target_user.id, 'admin', true
    from target_campaign, target_user
    returning user_id, campaign_id, role
  ),
  fix_profile as (
    update public.profiles
    set
      full_name = coalesce(
        (select (raw_user_meta_data->>'full_name') from auth.users where id = (select id from target_user)),
        (select (raw_user_meta_data->>'name') from auth.users where id = (select id from target_user)),
        full_name,
        'Admin'
      ),
      must_change_password = false   -- Google OAuth não tem senha local
    where id = (select id from target_user)
    returning id
  )
select
  target_user.email as admin_email,
  link.role,
  c.candidate_name as campanha
from target_user, link, target_campaign tc
join public.campaigns c on c.id = tc.id;
