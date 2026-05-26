-- ============================================================================
-- Vórtice — migration 015 — Novos papéis de usuário
--
-- Expande user_role com 3 novos valores: candidate, supporter, leader.
-- Migra usuários existentes com role='field_agent' para 'leader'
-- (que é o equivalente conceitual mais próximo no novo modelo).
--
-- Conjunto final de papéis na UI (6 valores ativos):
--   admin        → Administrador
--   candidate    → Candidato/Político     (NOVO)
--   coordinator  → Coordenador
--   researcher   → Pesquisador
--   supporter    → Apoiador               (NOVO)
--   leader       → Liderança              (NOVO)
--
-- field_agent permanece no enum (Postgres não permite DROP VALUE em enum),
-- mas é tratado como deprecated — não aparece em nenhum select da UI.
-- ============================================================================

-- 1. Adicionar os novos valores ao enum (idempotente).
alter type user_role add value if not exists 'candidate';
alter type user_role add value if not exists 'supporter';
alter type user_role add value if not exists 'leader';

-- NOTA: Postgres exige commit antes que valores recém-adicionados ao enum
-- possam ser usados em UPDATE/INSERT. Esse arquivo é uma única transação
-- pro SQL Editor — ele faz commit no fim. Se você quiser rodar o UPDATE
-- abaixo na mesma sessão, faça-o em uma SEGUNDA execução do editor (ou
-- separe os comandos em dois Runs).

-- 2. Migrar field_agent → leader em campaign_users (rodar separadamente
-- após o passo 1 ter sido commitado).
--
-- Descomente e rode em um segundo Run depois que o passo 1 estiver
-- commitado:
--
--   update public.campaign_users set role = 'leader' where role = 'field_agent';

-- Verificação --------------------------------------------------------------
select
  case
    when (
      select count(*) from pg_enum
      where enumtypid = 'user_role'::regtype
        and enumlabel in ('admin', 'candidate', 'coordinator',
                          'researcher', 'supporter', 'leader')
    ) = 6
    then 'OK — migration 015 (passo 1) aplicada. Rode o UPDATE em um segundo Run.'
    else 'FALHA'
  end as status;
