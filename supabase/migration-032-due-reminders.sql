-- ============================================================================
-- Vórtice — migration 032 — Régua de vencimento (D-7/D-3/D-1/D+0)
--
-- Job diário (pg_cron) que dispara a edge function send-notification via
-- pg_net pra avisar o cliente que o trial/assinatura está vencendo.
--
-- Cobre DOIS casos:
--   - trial    → base trial_ends_at
--   - active   → base paid_until (assinatura)
--
-- Credenciais (URL + token interno) lidas do Supabase Vault — não ficam no
-- git. Dedup via notification_logs (não reenvia o mesmo nível no mesmo dia).
--
-- NÃO toca o job existente vortice-expire-trials.
-- ============================================================================

-- 1) Extensões (idempotente)
create extension if not exists pg_net;

-- 2) Dispatcher: encontra campanhas em D-7/-3/-1/+0 e chama send-notification.
create or replace function public.dispatch_due_reminders()
returns table (campaign_id uuid, level text)
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  token text;
  rec record;
  lvl text;
  already int;
begin
  -- Lê config do Vault (criada via vault.create_secret — fora do git).
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'functions_base_url';
  select decrypted_secret into token   from vault.decrypted_secrets where name = 'internal_fn_token';
  if base_url is null or token is null then
    raise notice 'Vault sem functions_base_url/internal_fn_token — régua abortada';
    return;
  end if;

  for rec in
    select
      c.id,
      (case when c.status = 'trial' then c.trial_ends_at else c.paid_until end) as due
    from public.campaigns c
    where (c.status = 'trial'  and c.trial_ends_at is not null)
       or (c.status = 'active' and c.paid_until    is not null)
  loop
    -- dias restantes (data, em UTC) → nível da régua
    lvl := case (rec.due::date - current_date)
      when 7 then 'D-7'
      when 3 then 'D-3'
      when 1 then 'D-1'
      when 0 then 'D+0'
      else null
    end;
    if lvl is null then continue; end if;

    -- dedup: já enviou esse nível hoje pra essa campanha?
    select count(*) into already
    from public.notification_logs
    where notification_logs.campaign_id = rec.id
      and template = 'due_reminder'
      and level = lvl
      and created_at >= current_date;
    if already > 0 then continue; end if;

    -- dispara o e-mail/WhatsApp (assíncrono via pg_net)
    perform net.http_post(
      url := base_url || '/send-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-token', token
      ),
      body := jsonb_build_object(
        'template', 'due_reminder',
        'campaign_id', rec.id,
        'level', lvl
      )
    );

    campaign_id := rec.id;
    level := lvl;
    return next;
  end loop;
end;
$$;

-- 3) RPC pro botão manual no Admin (super admin only).
create or replace function public.run_due_reminders_now()
returns table (campaign_id uuid, level text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Apenas super admin pode rodar a régua';
  end if;
  return query select * from public.dispatch_due_reminders();
end;
$$;

grant execute on function public.run_due_reminders_now() to authenticated;

-- 4) Agenda diária às 12:00 UTC (09:00 BRT) — resiliente se pg_cron faltar.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'vortice-due-reminders';
  perform cron.schedule(
    'vortice-due-reminders',
    '0 12 * * *',
    $cron$ select public.dispatch_due_reminders() $cron$
  );
exception
  when others then
    raise notice 'pg_cron/pg_net indisponível ou sem permissão: %', sqlerrm;
end;
$$;

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (select 1 from pg_proc where proname = 'dispatch_due_reminders')
     and exists (select 1 from pg_proc where proname = 'run_due_reminders_now')
    then 'OK — migration 032 aplicada (régua de vencimento)'
    else 'FALHA'
  end as status;
