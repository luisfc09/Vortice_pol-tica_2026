-- ============================================================================
-- Vórtice — bootstrap do primeiro super admin
-- Rode após migration-004-super-admin.sql.
--
-- Substitui o e-mail abaixo pelo seu, ou deixa luisfc09@gmail.com se for você.
-- ============================================================================

insert into public.super_admins (user_id, notes)
select id, 'Owner do SaaS Vórtice'
from auth.users
where email = 'luisfc09@gmail.com'
on conflict (user_id) do nothing
returning user_id;

-- Verificação
select sa.user_id, u.email, sa.notes
from public.super_admins sa
join auth.users u on u.id = sa.user_id;
