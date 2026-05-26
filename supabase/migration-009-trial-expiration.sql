-- ============================================================================
-- Vórtice — migration 009
-- - Função para expirar trials vencidos (passar status para 'suspended')
-- - RPC para listar campanhas próximas de expirar
-- - Agendamento via pg_cron (extensão do Supabase) com fallback manual
-- ============================================================================

-- 1) Função que suspende trials vencidos
create or replace function public.expire_trial_campaigns()
returns table (id uuid, candidate_name text, expired_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.campaigns c
  set status = 'suspended'
  where c.status = 'trial'
    and c.trial_ends_at is not null
    and c.trial_ends_at < now()
  returning c.id, c.candidate_name, c.trial_ends_at;
end;
$$;

grant execute on function public.expire_trial_campaigns() to authenticated;

-- 2) RPC: campanhas próximas de expirar (para Super Admin e banner do client)
create or replace function public.trial_campaigns_expiring(p_days int default 7)
returns table (
  id uuid,
  candidate_name text,
  trial_ends_at timestamptz,
  days_remaining int
)
language sql stable security definer
set search_path = public
as $$
  select
    c.id,
    c.candidate_name,
    c.trial_ends_at,
    greatest(0, extract(day from c.trial_ends_at - now())::int) as days_remaining
  from public.campaigns c
  where c.status = 'trial'
    and c.trial_ends_at is not null
    and c.trial_ends_at <= now() + (p_days || ' days')::interval
    and (
      public.is_super_admin()
      or c.id = public.current_campaign_id()
    )
  order by c.trial_ends_at asc
$$;

grant execute on function public.trial_campaigns_expiring(int) to authenticated;

-- 3) Tentar habilitar pg_cron e agendar
do $$
begin
  create extension if not exists pg_cron;

  -- Remove agendamento antigo se existir
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'vortice-expire-trials';

  -- Agenda diário às 03:00 UTC (00:00 BRT)
  perform cron.schedule(
    'vortice-expire-trials',
    '0 3 * * *',
    $cron$ select public.expire_trial_campaigns() $cron$
  );
exception
  when others then
    raise notice 'pg_cron não disponível ou sem permissão: %', sqlerrm;
end;
$$;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (
      select 1 from pg_proc where proname = 'expire_trial_campaigns'
    )
    and exists (
      select 1 from pg_proc where proname = 'trial_campaigns_expiring'
    )
    then 'OK — migration 009 aplicada'
    else 'FALHA'
  end as status;
