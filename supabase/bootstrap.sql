-- ============================================================================
-- Vórtice — bootstrap inicial
-- Rode APÓS schema.sql e APÓS criar manualmente o primeiro usuário admin
-- (Authentication > Users > Add user).
--
-- 1. Crie a campanha
-- 2. Pegue o id do auth.user que será admin
-- 3. Ligue o user à campanha como admin
-- 4. Opcional: rode supabase/seed-faq.sql para popular FAQ global
--
-- O trigger handle_new_user já criou um profile para o auth.user. Se você
-- mudar o nome aqui, ele será sobrescrito no SELECT abaixo.
-- ============================================================================

-- STEP 1 — cria a campanha (edite os valores conforme seu candidato/UF/cargo)
with new_campaign as (
  insert into campaigns (
    name,
    candidate_name,
    party,
    party_number,
    state,
    office,
    election_year,
    logo_url
  )
  values (
    'Coligação MG 2026',     -- nome interno da campanha
    'Maria Andrade',         -- nome do candidato
    'Partido Exemplo',       -- partido
    '99',                    -- número da legenda
    'MG',                    -- UF
    'Governador',            -- cargo
    2026,                    -- ano da eleição
    null                     -- logo_url (opcional)
  )
  returning id
)
select 'Campanha criada com id:' as msg, id from new_campaign;

-- STEP 2 — liste os usuários disponíveis para você escolher o admin:
select id, email, created_at
from auth.users
order by created_at desc;

-- STEP 3 — ligue o admin à campanha. Substitua os UUIDs abaixo:
-- (use os ids retornados nos passos acima)
--
-- insert into campaign_users (campaign_id, user_id, role)
-- values (
--   'UUID-DA-CAMPANHA-RETORNADO-NO-STEP-1',
--   'UUID-DO-AUTH-USER-RETORNADO-NO-STEP-2',
--   'admin'
-- );

-- STEP 4 (opcional) — ajuste o nome do profile criado automaticamente:
-- update profiles
-- set full_name = 'Seu Nome', phone = '(31) 99999-0000'
-- where id = 'UUID-DO-AUTH-USER';

-- ============================================================================
-- Verificação: deve retornar 1 linha
-- select c.candidate_name, p.full_name, cu.role
-- from campaign_users cu
-- join campaigns c on c.id = cu.campaign_id
-- join profiles p on p.id = cu.user_id;
-- ============================================================================
