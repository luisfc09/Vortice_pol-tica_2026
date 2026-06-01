-- ============================================================================
-- Vórtice — migration 043 — Detectores de alerta do módulo Financeiro
-- ----------------------------------------------------------------------------
-- Adiciona 3 valores ao enum `alert_type` para que o detector em
-- src/lib/alertDetector.ts consiga inserir os alertas:
--   • finance_cidade_vermelha  → critico (uma por cidade com R$/voto > amarelo)
--   • finance_teto_ultrapassado → urgente (planejado > budget_total)
--   • finance_deficit_previsto  → atencao (receitas < planejado)
--
-- ⚠ IMPORTANTE: Postgres exige que novos valores de enum estejam COMMITTED
-- antes do uso. Por isso esta migration vem em DOIS blocos que precisam ser
-- rodados separadamente no Supabase SQL Editor:
--   1. Cole e rode o BLOCO 1 — aguarde "Success"
--   2. Apague tudo, cole e rode o BLOCO 2
-- O erro "55P04: unsafe use of new value … New enum values must be committed
-- before they can be used" significa que o SELECT do bloco 2 foi rodado junto
-- com os ALTERs do bloco 1.
-- ============================================================================

-- ============================================================================
-- BLOCO 1 — ALTER TYPE (idempotente, instantâneo)
-- ============================================================================
alter type alert_type add value if not exists 'finance_cidade_vermelha';
alter type alert_type add value if not exists 'finance_teto_ultrapassado';
alter type alert_type add value if not exists 'finance_deficit_previsto';


-- ============================================================================
-- BLOCO 2 — Verificação (rodar em transação separada)
-- ============================================================================
select
  case
    when 'finance_cidade_vermelha'  = any (enum_range(null::alert_type)::text[])
     and 'finance_teto_ultrapassado' = any (enum_range(null::alert_type)::text[])
     and 'finance_deficit_previsto'  = any (enum_range(null::alert_type)::text[])
    then 'OK — migration 043 aplicada'
    else 'FALHA — algum valor faltando'
  end as status;
