-- ============================================================================
-- Vórtice — migration 029 — colunas de pagamento (Passo 2)
--
-- ADITIVA: só ADD COLUMN / ADD VALUE. NÃO renomeia nem migra enums existentes.
-- Mantém status em inglês (trial/active/suspended/cancelled) e plano 'top'.
--
--   - activation_type: como a campanha foi ativada (trial / paid / manual)
--   - paid_until: até quando o pagamento cobre (atualizado pelo webhook Asaas)
--   - asaas_customer_id / asaas_subscription_id: vínculo com o Asaas
--   - status ganha o valor 'pending' (aguardando 1º pagamento, no fluxo "paid")
-- ============================================================================

-- 1) Novo valor 'pending' no enum de status (aditivo — não usa no mesmo escopo)
alter type campaign_status add value if not exists 'pending';

-- 2) Colunas novas em campaigns (idempotentes)
alter table public.campaigns
  add column if not exists activation_type text not null default 'trial'
    check (activation_type in ('trial', 'paid', 'manual')),
  add column if not exists paid_until timestamptz,
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text;

-- Índices úteis pro webhook localizar a campanha rapidamente
create index if not exists campaigns_asaas_customer_idx
  on public.campaigns (asaas_customer_id);
create index if not exists campaigns_asaas_subscription_idx
  on public.campaigns (asaas_subscription_id);

-- Verificação --------------------------------------------------------------
select
  case
    when exists (
      select 1 from information_schema.columns
      where table_name = 'campaigns' and column_name = 'activation_type'
    )
    and exists (
      select 1 from information_schema.columns
      where table_name = 'campaigns' and column_name = 'asaas_subscription_id'
    )
    then 'OK — migration 029 aplicada (activation_type, paid_until, asaas_*; status += pending)'
    else 'FALHA'
  end as status;
