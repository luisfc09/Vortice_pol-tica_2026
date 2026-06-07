-- ============================================================================
-- Vórtice — migration 046 — Hierarquia de Lideranças (Fase 1)
-- ----------------------------------------------------------------------------
-- Adiciona à tabela `supporters`:
--   • referrer_id uuid (auto-FK, ON DELETE SET NULL)
--   • invite_code text UNIQUE NOT NULL (gerado automaticamente)
--
-- Cria:
--   • Índice parcial em referrer_id (só não-nulos)
--   • Trigger que valida:
--       - referrer_id ≠ id (não-self)
--       - referrer.campaign_id == supporters.campaign_id (cross-campaign)
--
-- NÃO adiciona colunas pip_score / nivel_influencia — essas métricas são
-- calculadas no frontend (src/lib/hierarchy.ts) a partir da árvore
-- carregada pelo useCollection. Mais simples, sem dívida de trigger.
--
-- Idempotente: pode rodar várias vezes sem erro.
-- ============================================================================

-- 1) referrer_id (auto-FK)
alter table public.supporters
  add column if not exists referrer_id uuid
  references public.supporters(id) on delete set null;

create index if not exists idx_supporters_referrer
  on public.supporters (referrer_id)
  where referrer_id is not null;

-- 2) invite_code (text unique, gerado automaticamente)
-- 8 chars hex uppercase (ex.: "A3F9C2E1") — 4.3 bilhões de combos.
alter table public.supporters
  add column if not exists invite_code text;

-- Backfill: preenche registros existentes que ainda não têm código.
update public.supporters
set invite_code = upper(substr(md5(gen_random_uuid()::text), 1, 8))
where invite_code is null;

-- Default pra novos registros
alter table public.supporters
  alter column invite_code
  set default upper(substr(md5(gen_random_uuid()::text), 1, 8));

-- Garante que ninguém vai mais ter invite_code nulo + unicidade
alter table public.supporters
  alter column invite_code set not null;

alter table public.supporters
  drop constraint if exists supporters_invite_code_unique;
alter table public.supporters
  add constraint supporters_invite_code_unique unique (invite_code);

-- 3) Trigger: valida same-campaign + não-self ao set/update referrer_id
create or replace function public.supporters_check_referrer()
returns trigger language plpgsql as $$
begin
  if new.referrer_id is not null then
    if new.id = new.referrer_id then
      raise exception 'Liderança não pode indicar a si mesma (id=%)', new.id;
    end if;
    if not exists (
      select 1 from public.supporters
      where id = new.referrer_id
        and campaign_id = new.campaign_id
    ) then
      raise exception 'Indicador % não pertence à mesma campanha %',
        new.referrer_id, new.campaign_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_supporters_check_referrer on public.supporters;
create trigger trg_supporters_check_referrer
  before insert or update of referrer_id, campaign_id on public.supporters
  for each row execute function public.supporters_check_referrer();

-- 4) Reload PostgREST pra ele enxergar as colunas novas
notify pgrst, 'reload schema';

-- ============================================================================
-- Verificação
-- ============================================================================
select
  exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='supporters'
            and column_name='referrer_id')                                as tem_referrer,
  exists (select 1 from information_schema.columns
          where table_schema='public' and table_name='supporters'
            and column_name='invite_code')                                as tem_invite_code,
  (select count(*) from public.supporters where invite_code is null)      as sem_invite_code,
  (select count(distinct invite_code) = count(*) from public.supporters)  as invite_codes_todos_unicos,
  exists (select 1 from information_schema.triggers
          where trigger_name='trg_supporters_check_referrer')             as tem_trigger,
  exists (select 1 from pg_constraint
          where conname='supporters_invite_code_unique')                  as tem_unique_constraint;
