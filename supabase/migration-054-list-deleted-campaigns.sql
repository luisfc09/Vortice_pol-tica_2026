-- ============================================================================
-- Vórtice — migration 054 — Lixeira de campanhas (listar excluídas)
--
-- Espelha list_campaigns_overview() (migration-033), mas devolve as campanhas
-- SOFT-DELETED (deleted_at IS NOT NULL) + a coluna deleted_at. Usada pelo
-- super admin no painel Admin pra ver e RESTAURAR campanhas apagadas (o
-- restore_campaign() já existe na 033) — sem precisar de SQL.
--
-- Só super admin (via is_super_admin() dentro do WHERE). Idempotente.
-- ============================================================================

create or replace function public.list_deleted_campaigns()
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
  deleted_at timestamptz,
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
    c.deleted_at,
    (select count(*) from public.campaign_users cu where cu.campaign_id = c.id and cu.is_active),
    (select count(*) from public.supporters s where s.campaign_id = c.id),
    (select count(*) from public.voters v where v.campaign_id = c.id)
  from public.campaigns c
  where public.is_super_admin()
    and c.deleted_at is not null
  order by c.deleted_at desc
$$;

grant execute on function public.list_deleted_campaigns() to authenticated;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (select 1 from pg_proc where proname = 'list_deleted_campaigns')
     and exists (select 1 from pg_proc where proname = 'restore_campaign')
    then 'OK migration 054 aplicada (lixeira de campanhas)'
    else 'FALHA'
  end as status;
