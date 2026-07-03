-- ============================================================================
-- Vórtice — migration 051 — Fecha a RPC submit_public_response ao anon
--
-- CONTEXTO (hardening pós-teste adversarial):
--   A migration 050 fez `revoke all ... from public` na função
--   submit_public_response, esperando que só service_role (a edge function)
--   pudesse executá-la. Mas o Supabase mantém um ALTER DEFAULT PRIVILEGES que
--   concede EXECUTE em novas funções do schema public DIRETAMENTE aos roles
--   anon/authenticated — então o revoke de `public` não os atinge.
--
--   Resultado: o anon conseguia chamar submit_public_response direto (via
--   PostgREST /rpc/), passando um p_ip_hash arbitrário e furando o limite de
--   1-resposta-por-IP (spam de respostas).
--
-- CORREÇÃO: revoga EXECUTE explicitamente de anon e authenticated. Só
-- service_role (usado pela edge function public-survey-submit, que calcula o
-- ip_hash confiável a partir do x-forwarded-for) mantém o grant.
--
-- get_public_survey_by_token CONTINUA aberta ao anon (é read-only e segura —
-- só devolve metadados + perguntas por token válido).
--
-- Idempotente.
-- ============================================================================

revoke execute on function
  public.submit_public_response(text, jsonb, text, text, text, text, text, text, text)
  from anon, authenticated, public;

-- Garante que service_role mantém (a edge function depende disso).
grant execute on function
  public.submit_public_response(text, jsonb, text, text, text, text, text, text, text)
  to service_role;

-- ============================================================================
-- Verificação — lista quem tem EXECUTE na função (esperado: só service_role
-- e o owner postgres). NÃO deve aparecer anon nem authenticated.
-- ============================================================================
select
  r.rolname as grantee
from pg_proc p
cross join lateral aclexplode(p.proacl) acl
join pg_roles r on r.oid = acl.grantee
where p.proname = 'submit_public_response'
  and acl.privilege_type = 'EXECUTE'
order by r.rolname;
