-- ============================================================================
-- Vórtice — migration 044 — Renomear agente Steve_AI → Vera_IA
-- ----------------------------------------------------------------------------
-- Atualiza:
--   1. ai_agents: agent_key 'steve' → 'vera'; name 'Steve_AI' → 'Vera_IA';
--      default da coluna name; CHECK constraint (steve|carlos) → (vera|carlos).
--   2. agent_conversations: agent_key 'steve' → 'vera' + default 'vera'.
--
-- ⚠ Idempotente — pode ser rodada várias vezes sem erro.
-- ⚠ Pode rodar TUDO em UM ÚNICO bloco (sem o problema de enum-committed do
--    migration-043, porque agent_key aqui é `text` com CHECK, não enum).
-- ============================================================================

-- 1) ai_agents ---------------------------------------------------------------

-- Drop CHECK constraint antiga (qualquer nome; usa pg_constraint pra ser
-- robusto a renomeações automáticas do Postgres).
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.ai_agents'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%agent_key%'
  loop
    execute 'alter table public.ai_agents drop constraint ' || quote_ident(c);
  end loop;
end $$;

-- Migra dados existentes
update public.ai_agents set agent_key = 'vera' where agent_key = 'steve';
update public.ai_agents set name      = 'Vera_IA' where name = 'Steve_AI';

-- Atualiza default da coluna name + recria CHECK com os novos valores
alter table public.ai_agents alter column name set default 'Vera_IA';
alter table public.ai_agents
  add constraint ai_agents_agent_key_check
  check (agent_key in ('vera','carlos'));

-- 2) agent_conversations -----------------------------------------------------

update public.agent_conversations set agent_key = 'vera' where agent_key = 'steve';
alter table public.agent_conversations alter column agent_key set default 'vera';

-- ============================================================================
-- Verificação
-- ============================================================================
select
  (select count(*) from public.ai_agents          where agent_key = 'steve') as ai_agents_still_steve,
  (select count(*) from public.agent_conversations where agent_key = 'steve') as convos_still_steve,
  (select count(*) from public.ai_agents          where agent_key = 'vera')  as ai_agents_vera,
  (select count(*) from public.agent_conversations where agent_key = 'vera')  as convos_vera;
-- Esperado: ai_agents_still_steve = 0, convos_still_steve = 0
-- ai_agents_vera e convos_vera = quantas linhas você tinha antes
