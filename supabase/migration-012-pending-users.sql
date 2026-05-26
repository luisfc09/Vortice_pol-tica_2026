-- ============================================================================
-- Vórtice — migration 012 — Aguardando ativação
-- - list_pending_users(): admin lista users com auth.user mas sem campaign_users
-- - approve_user(p_user_id, p_role, p_full_name): aprova e vincula à campanha
--   do admin que está chamando
-- ============================================================================

create or replace function public.list_pending_users()
returns table (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    public.is_super_admin()
    or public.current_user_role() in ('admin', 'coordinator')
  ) then
    raise exception 'Apenas admin ou coordenador pode listar pendentes';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.email::text) as full_name,
    u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.email is not null
    and not exists (
      select 1 from public.campaign_users cu
      where cu.user_id = u.id and cu.is_active = true
    )
  order by u.created_at desc
  limit 50;
end;
$$;

grant execute on function public.list_pending_users() to authenticated;

create or replace function public.approve_user(
  p_user_id uuid,
  p_role user_role,
  p_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_campaign uuid;
  inserted_id uuid;
begin
  -- Resolve campanha do caller (precisa ser admin/coord ativo)
  select campaign_id into caller_campaign
  from public.campaign_users
  where user_id = auth.uid()
    and is_active = true
    and role in ('admin', 'coordinator')
  limit 1;

  if caller_campaign is null and not public.is_super_admin() then
    raise exception 'Apenas admin/coord da campanha pode aprovar usuários';
  end if;

  -- Verifica se o p_user_id já tem membership ativo em qualquer campanha
  if exists (
    select 1 from public.campaign_users
    where user_id = p_user_id and is_active = true
  ) then
    raise exception 'Usuário já está vinculado a uma campanha';
  end if;

  -- Cria membership
  insert into public.campaign_users (campaign_id, user_id, role, invited_by, is_active)
  values (
    coalesce(caller_campaign, public.current_campaign_id()),
    p_user_id,
    p_role,
    auth.uid(),
    true
  )
  returning id into inserted_id;

  -- Atualiza profile com nome correto (não força mudança de senha — veio via OAuth)
  update public.profiles
  set full_name = p_full_name,
      must_change_password = false
  where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'campaign_user_id', inserted_id,
    'user_id', p_user_id
  );
end;
$$;

grant execute on function public.approve_user(uuid, user_role, text) to authenticated;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (select 1 from pg_proc where proname = 'list_pending_users')
    and exists (select 1 from pg_proc where proname = 'approve_user')
    then 'OK — migration 012 aplicada'
    else 'FALHA'
  end as status;
