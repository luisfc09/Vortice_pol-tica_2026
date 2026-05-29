-- ============================================================================
-- Vórtice — migration 033 — Soft delete de campanha (com auditoria)
--
-- "Apagar campanha" do super admin = SOFT DELETE: marca deleted_at, esconde
-- das listas e CORTA o acesso dos usuários (current_campaign_id ignora). Os
-- dados NÃO são removidos — ficam recuperáveis via restore_campaign().
--
-- Toda exclusão grava uma linha em campaign_deletion_logs com o NOME do super
-- admin que apagou (auditoria que sobrevive à exclusão — sem FK).
--
-- Idempotente. Não toca em policies de delete físico (continua super-admin-only).
-- ============================================================================

-- 1) Colunas de soft delete em campaigns ------------------------------------
alter table public.campaigns
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id);

create index if not exists idx_campaigns_deleted_at
  on public.campaigns (deleted_at);

-- 2) Tabela de auditoria de exclusões (snapshot; sem FK pra sobreviver) ------
create table if not exists public.campaign_deletion_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  candidate_name text,
  party text,
  office text,
  state text,
  plan text,
  status_anterior text,
  deleted_by uuid,
  deleted_by_name text,
  deleted_by_email text,
  reason text,
  deleted_at timestamptz not null default now()
);

create index if not exists idx_campaign_deletion_logs_at
  on public.campaign_deletion_logs (deleted_at desc);

alter table public.campaign_deletion_logs enable row level security;

drop policy if exists campaign_deletion_logs_super_admin_select on public.campaign_deletion_logs;
create policy campaign_deletion_logs_super_admin_select on public.campaign_deletion_logs
  for select using (public.is_super_admin());

-- 3) current_campaign_id(): ignora campanhas soft-deleted (corta o acesso) ---
--    (mantém os filtros da migration-027: membership ativo + status, ordenado)
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
    and c.deleted_at is null
  order by cu.created_at asc, cu.campaign_id asc
  limit 1
$$;

-- 4) list_campaigns_overview(): esconde as excluídas da lista do admin -------
--    (mesma assinatura da migration-004 — só adiciona o filtro deleted_at)
create or replace function public.list_campaigns_overview()
returns table (
  id uuid,
  candidate_name text,
  party text,
  party_number text,
  state text,
  office text,
  election_year int,
  status campaign_status,
  trial_ends_at timestamptz,
  notes text,
  created_at timestamptz,
  members_count bigint,
  supporters_count bigint,
  voters_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.candidate_name,
    c.party,
    c.party_number,
    c.state,
    c.office,
    c.election_year,
    c.status,
    c.trial_ends_at,
    c.notes,
    c.created_at,
    (select count(*) from public.campaign_users cu where cu.campaign_id = c.id and cu.is_active),
    (select count(*) from public.supporters s where s.campaign_id = c.id),
    (select count(*) from public.voters v where v.campaign_id = c.id)
  from public.campaigns c
  where public.is_super_admin()
    and c.deleted_at is null
  order by c.created_at desc
$$;

grant execute on function public.list_campaigns_overview() to authenticated;

-- 5) RPC soft_delete_campaign — super admin only, grava log com nome ---------
create or replace function public.soft_delete_campaign(
  p_campaign_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_camp public.campaigns%rowtype;
  v_name text;
  v_email text;
begin
  if not public.is_super_admin() then
    raise exception 'Apenas super admin pode apagar campanhas';
  end if;

  select * into v_camp
  from public.campaigns
  where id = p_campaign_id and deleted_at is null;
  if not found then
    raise exception 'Campanha não encontrada ou já excluída';
  end if;

  -- Nome/e-mail do admin que está apagando (auth.uid()).
  select p.full_name, u.email into v_name, v_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid();

  insert into public.campaign_deletion_logs (
    campaign_id, candidate_name, party, office, state, plan, status_anterior,
    deleted_by, deleted_by_name, deleted_by_email, reason
  ) values (
    v_camp.id, v_camp.candidate_name, v_camp.party, v_camp.office, v_camp.state,
    v_camp.plan::text, v_camp.status::text,
    auth.uid(), v_name, v_email, p_reason
  );

  update public.campaigns
    set deleted_at = now(), deleted_by = auth.uid()
    where id = p_campaign_id;
end;
$$;

grant execute on function public.soft_delete_campaign(uuid, text) to authenticated;

-- 6) RPC restore_campaign — desfaz o soft delete (super admin only) ----------
create or replace function public.restore_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Apenas super admin pode restaurar campanhas';
  end if;
  update public.campaigns
    set deleted_at = null, deleted_by = null
    where id = p_campaign_id;
end;
$$;

grant execute on function public.restore_campaign(uuid) to authenticated;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'campaign_deletion_logs')
     and exists (select 1 from pg_proc where proname = 'soft_delete_campaign')
     and exists (select 1 from pg_proc where proname = 'restore_campaign')
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'campaigns'
                   and column_name = 'deleted_at')
    then 'OK — migration 033 aplicada (soft delete de campanha)'
    else 'FALHA'
  end as status;
