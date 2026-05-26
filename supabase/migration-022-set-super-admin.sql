-- ============================================================================
-- Vórtice — migration 022 — RPCs pra gerenciar super admin a partir da UI
--
-- A tela /usuarios passa a oferecer um toggle "Super Admin Vórtice" para
-- cada usuário. Quem chama o RPC precisa SER super admin — senão a função
-- recusa. Garantido por is_super_admin() dentro da própria função.
--
-- Também expomos list_super_admin_user_ids() para o frontend conseguir
-- pintar o badge "Super Admin" no card de cada user sem ler super_admins
-- diretamente (RLS protege essa tabela).
-- ============================================================================

-- 1) Toggle: promove ou rebaixa um user. p_value=true insere, false remove.
create or replace function public.set_super_admin(
  p_user_id uuid,
  p_value boolean,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Não autenticado.';
  end if;
  if not public.is_super_admin() then
    raise exception 'Apenas Super Admin Vórtice pode alterar este privilégio.';
  end if;

  -- Proteção elementar: caller não consegue se rebaixar sozinho enquanto
  -- ele for o ÚNICO super admin. Evita "ficar sem super admin".
  if p_user_id = caller and not p_value then
    if (select count(*) from public.super_admins) <= 1 then
      raise exception 'Não é possível rebaixar — você é o único Super Admin.';
    end if;
  end if;

  if p_value then
    insert into public.super_admins (user_id, notes)
    values (p_user_id, p_notes)
    on conflict (user_id) do nothing;
  else
    delete from public.super_admins where user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'is_super_admin', p_value
  );
end;
$$;

grant execute on function public.set_super_admin(uuid, boolean, text) to authenticated;

-- 2) Listagem que o frontend usa pra pintar o badge. Não revela colunas
-- sensíveis (notes, created_at) — apenas os UUIDs.
create or replace function public.list_super_admin_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.super_admins;
$$;

grant execute on function public.list_super_admin_user_ids() to authenticated;

-- Verificação --------------------------------------------------------------
select
  case
    when exists (select 1 from pg_proc where proname = 'set_super_admin')
     and exists (select 1 from pg_proc where proname = 'list_super_admin_user_ids')
    then 'OK — migration 022 aplicada (set_super_admin + list_super_admin_user_ids)'
    else 'FALHA'
  end as status;
