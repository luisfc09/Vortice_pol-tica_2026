-- ============================================================================
-- Vórtice — migration 045 — campos extras em supporters (Lideranças)
-- ----------------------------------------------------------------------------
-- Adiciona 4 colunas em `supporters` (todas nullable para não quebrar
-- registros existentes):
--   • vote_potential    integer  — estimativa de votos que a liderança entrega
--   • whatsapp          text     — número WhatsApp (formato igual ao phone)
--   • social_platform   text     — plataforma da rede social (CHECK enum-like)
--   • social_handle     text     — @usuario ou URL do perfil
--
-- Usamos CHECK constraint em vez de enum Postgres para `social_platform`
-- porque é mais fácil ampliar/remover plataformas no futuro (sem o ritual
-- de "enum value committed before usage" da migration-043).
-- ============================================================================

alter table public.supporters
  add column if not exists vote_potential integer;
alter table public.supporters
  add constraint supporters_vote_potential_nonneg
  check (vote_potential is null or vote_potential >= 0);

alter table public.supporters
  add column if not exists whatsapp text;

alter table public.supporters
  add column if not exists social_platform text;
alter table public.supporters
  add constraint supporters_social_platform_check
  check (social_platform is null or social_platform in (
    'instagram','facebook','x','tiktok','linkedin','youtube','outro'
  ));

alter table public.supporters
  add column if not exists social_handle text;

notify pgrst, 'reload schema';

-- Verificação
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema='public' and table_name='supporters'
  and column_name in ('vote_potential','whatsapp','social_platform','social_handle')
order by column_name;
-- Esperado: 4 linhas, todas com is_nullable = YES
