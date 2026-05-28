-- ============================================================================
-- Vórtice — migration 031 — auditoria de notificações (e-mail + WhatsApp)
--
-- Registra cada disparo feito pela edge function send-notification.
-- Escrita só via service-role; leitura só pelo super admin (aba no Admin).
-- ============================================================================

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns (id) on delete set null,
  template text not null,               -- welcome | payment_confirmed | due_reminder
  level text,                            -- D-7 | D-3 | D-1 | D+0 (só due_reminder)
  email text,
  phone text,
  email_sent boolean not null default false,
  whatsapp_sent boolean not null default false,
  whatsapp_skipped boolean not null default false,
  email_error text,
  whatsapp_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_logs_campaign
  on public.notification_logs (campaign_id);
create index if not exists idx_notification_logs_template
  on public.notification_logs (template, created_at desc);

alter table public.notification_logs enable row level security;

drop policy if exists notification_logs_super_admin_select on public.notification_logs;
create policy notification_logs_super_admin_select on public.notification_logs
  for select using (public.is_super_admin());

-- Verificação --------------------------------------------------------------
select
  case
    when exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'notification_logs'
    )
    then 'OK — migration 031 aplicada (notification_logs)'
    else 'FALHA'
  end as status;
