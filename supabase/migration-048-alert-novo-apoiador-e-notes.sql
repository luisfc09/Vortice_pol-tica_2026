-- ============================================================================
-- Vórtice — migration 048
-- ----------------------------------------------------------------------------
-- Duas mudanças combinadas:
--
-- 1) Adiciona valor 'novo_apoiador_cadastrado' ao enum public.alert_type.
--    Usado pelo detector novo em src/lib/alertDetector.ts que avisa o admin
--    quando um supporter/leader cadastra um novo apoiador via /minha-rede.
--
-- 2) Adiciona coluna `notes text` (nullable) na tabela `supporters` — campo
--    livre de observações usado pelo novo formulário AddSupporterSheet
--    (cadastro manual pelo próprio apoiador em /minha-rede).
--
-- ⚠️ PEGADINHA (§14.4 da doc técnica):
--   • Novos valores de enum PRECISAM ser commitados antes de uso.
--   • `ALTER TYPE ADD VALUE` + qualquer `SELECT` que use o novo valor no
--     MESMO bloco do SQL Editor falham com "unsafe use of new value".
--   • Solução: rodar a migração em DOIS blocos separados:
--       BLOCO 1: ALTER TYPE + ALTER TABLE + NOTIFY pgrst
--       BLOCO 2: verificação (depois do commit do BLOCO 1)
--
-- Ordem de execução no SQL Editor do Supabase:
--   1. Cole BLOCO 1 → Run
--   2. Cole BLOCO 2 → Run (deve devolver 'OK')
--
-- Não há rollback automático: para reverter, apague a coluna `notes`
-- (DROP COLUMN). O novo valor de enum NÃO pode ser removido sem recriar
-- o enum inteiro — em geral é seguro deixar.
-- ============================================================================

-- ============================================================================
-- BLOCO 1 — alterações de schema
-- ============================================================================

alter type public.alert_type add value if not exists 'novo_apoiador_cadastrado';

alter table public.supporters
  add column if not exists notes text;

-- Pede ao PostgREST que recarregue o schema (best-effort — é flaky para
-- mudanças estruturais. Se a coluna `notes` não aparecer no frontend após
-- ~1 min, faça Dashboard → Settings → API → Restart server).
notify pgrst, 'reload schema';

-- ============================================================================
-- BLOCO 2 — verificação (rodar em SEPARADO, depois do BLOCO 1 commitar)
-- ============================================================================

select
  case
    when 'novo_apoiador_cadastrado' = any (enum_range(null::public.alert_type)::text[])
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'supporters'
         and column_name = 'notes'
     )
    then 'OK — migration-048 aplicada (alert_type + supporters.notes)'
    else 'FALHA — verifique se ambos os blocos rodaram'
  end as status;
