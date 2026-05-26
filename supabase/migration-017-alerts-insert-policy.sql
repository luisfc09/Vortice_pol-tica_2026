-- ============================================================================
-- Vórtice — migration 017 — Policy de INSERT/DELETE em alerts
--
-- O schema original só definia alerts_select e alerts_update. Com RLS
-- habilitado e sem policy de INSERT, todo write pela API anon era
-- bloqueado com 'new row violates row-level security policy for table
-- "alerts"'. Isso quebrava o useAlertas, que detecta sinais (cabo
-- sumido, entrevistas paradas etc.) e cria alertas no boot da campanha.
--
-- A regra: qualquer membro ativo da campanha pode inserir/deletar
-- alertas da PRÓPRIA campanha. Não há risco de cross-tenant porque
-- current_campaign_id() já resolve isso pelo JWT.
-- ============================================================================

drop policy if exists alerts_insert on public.alerts;
create policy alerts_insert on public.alerts
  for insert
  with check (campaign_id = public.current_campaign_id());

drop policy if exists alerts_delete on public.alerts;
create policy alerts_delete on public.alerts
  for delete
  using (campaign_id = public.current_campaign_id());

-- Verificação --------------------------------------------------------------
select
  case
    when exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'alerts'
        and policyname = 'alerts_insert'
    )
    then 'OK — migration 017 aplicada (alerts_insert + alerts_delete)'
    else 'FALHA'
  end as status;
