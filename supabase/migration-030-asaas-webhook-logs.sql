-- ============================================================================
-- Vórtice — migration 030 — log de webhooks do Asaas
--
-- Auditoria de cada evento recebido do Asaas (ativação/suspensão automática).
-- Escrita SÓ via service-role (edge function asaas-webhook). Leitura só pelo
-- super admin (aba de logs no Admin Vórtice).
-- ============================================================================

create table if not exists public.asaas_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  asaas_payment_id text,
  asaas_customer_id text,
  campaign_id uuid references public.campaigns (id) on delete set null,
  status_anterior text,
  status_novo text,
  paid_until_novo timestamptz,
  payload jsonb,
  processed_at timestamptz not null default now(),
  error text
);

create index if not exists idx_webhook_logs_campaign
  on public.asaas_webhook_logs (campaign_id);
create index if not exists idx_webhook_logs_event
  on public.asaas_webhook_logs (event_type, processed_at desc);

alter table public.asaas_webhook_logs enable row level security;

-- Leitura: só super admin (pro painel). Escrita: só service-role (bypassa RLS).
drop policy if exists asaas_webhook_logs_super_admin_select on public.asaas_webhook_logs;
create policy asaas_webhook_logs_super_admin_select on public.asaas_webhook_logs
  for select using (public.is_super_admin());

-- Verificação --------------------------------------------------------------
select
  case
    when exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'asaas_webhook_logs'
    )
    then 'OK — migration 030 aplicada (asaas_webhook_logs)'
    else 'FALHA'
  end as status;
