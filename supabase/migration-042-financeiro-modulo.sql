-- ============================================================================
-- Vórtice — migration 042 — Módulo Financeiro
-- ----------------------------------------------------------------------------
-- Cria as 3 tabelas do módulo Financeiro + RLS + GRANTs + triggers de
-- updated_at + reload do PostgREST.
--
-- Idempotente: pode rodar várias vezes sem erro (usa `if not exists`,
-- `drop ... if exists`, `create or replace`).
--
-- Tabelas:
--   • campaign_finance_config: 1 linha por campanha — orçamento, faixas
--     do semáforo, meta de votos geral, observações.
--   • finance_revenues: cada aporte/receita pontual (fundo eleitoral,
--     doação PF/PJ, recursos próprios, outros).
--   • finance_city_plans: planejamento financeiro por cidade — meta de
--     votos, custos planejados (coord, cabos, veículos, combustível,
--     materiais, outros) + custos realizados (espelho com sufixo _real,
--     todos nullable).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabelas
-- ----------------------------------------------------------------------------
create table if not exists public.campaign_finance_config (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid not null unique references public.campaigns(id) on delete cascade,
  budget_total          numeric(12, 2),
  semaforo_verde_max    numeric(8, 2)  not null default 25,
  semaforo_amarelo_max  numeric(8, 2)  not null default 40,
  meta_votos_geral      integer,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.finance_revenues (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  source_type   text not null check (source_type in (
    'fundo_eleitoral',
    'doacao_pessoa_fisica',
    'doacao_pessoa_juridica',
    'recursos_proprios',
    'outros'
  )),
  description   text,
  amount        numeric(12, 2) not null,
  revenue_date  date not null,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.finance_city_plans (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.campaigns(id) on delete cascade,
  municipality_code   text references public.municipalities(ibge_code),
  city_name           text not null,
  polo_logistico      text,
  meta_votos_2022     integer not null default 0,
  meta_votos_2026     integer not null default 0,
  -- PLANEJADO
  coord_name          text,
  coord_value         numeric(10, 2) not null default 0,
  cabos_qty           integer not null default 0,
  cabo_unit_value     numeric(10, 2) not null default 0,
  vehicles_qty        integer not null default 0,
  vehicles_cost       numeric(10, 2) not null default 0,
  fuel_cost           numeric(10, 2) not null default 0,
  materials_cost      numeric(10, 2) not null default 0,
  others_cost         numeric(10, 2) not null default 0,
  -- REALIZADO (nullable)
  coord_value_real    numeric(10, 2),
  cabos_cost_real     numeric(10, 2),
  vehicles_cost_real  numeric(10, 2),
  fuel_cost_real      numeric(10, 2),
  materials_cost_real numeric(10, 2),
  others_cost_real    numeric(10, 2),
  notes               text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (campaign_id, municipality_code)
);

-- ----------------------------------------------------------------------------
-- 2) Índices
-- ----------------------------------------------------------------------------
create index if not exists idx_finance_revenues_campaign
  on public.finance_revenues (campaign_id, revenue_date desc);

create index if not exists idx_finance_city_plans_campaign
  on public.finance_city_plans (campaign_id);

-- ----------------------------------------------------------------------------
-- 3) RLS — habilitar
-- ----------------------------------------------------------------------------
alter table public.campaign_finance_config enable row level security;
alter table public.finance_revenues        enable row level security;
alter table public.finance_city_plans      enable row level security;

-- ----------------------------------------------------------------------------
-- 4) Policies (drop + create — idempotente)
-- ----------------------------------------------------------------------------
drop policy if exists finance_config_campaign on public.campaign_finance_config;
create policy finance_config_campaign on public.campaign_finance_config
  for all
  using      (is_super_admin() or campaign_id = current_campaign_id())
  with check (is_super_admin() or campaign_id = current_campaign_id());

drop policy if exists finance_revenues_campaign on public.finance_revenues;
create policy finance_revenues_campaign on public.finance_revenues
  for all
  using      (is_super_admin() or campaign_id = current_campaign_id())
  with check (is_super_admin() or campaign_id = current_campaign_id());

drop policy if exists finance_city_plans_campaign on public.finance_city_plans;
create policy finance_city_plans_campaign on public.finance_city_plans
  for all
  using      (is_super_admin() or campaign_id = current_campaign_id())
  with check (is_super_admin() or campaign_id = current_campaign_id());

-- ----------------------------------------------------------------------------
-- 5) GRANTs — sem isso o PostgREST devolve 404 (problema da tela preta)
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on public.campaign_finance_config to authenticated;
grant select, insert, update, delete on public.finance_revenues        to authenticated;
grant select, insert, update, delete on public.finance_city_plans      to authenticated;

-- ----------------------------------------------------------------------------
-- 6) Triggers de updated_at
-- ----------------------------------------------------------------------------
create or replace function public.touch_finance_config_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_finance_config_updated_at on public.campaign_finance_config;
create trigger trg_finance_config_updated_at
  before update on public.campaign_finance_config
  for each row execute function public.touch_finance_config_updated_at();

create or replace function public.touch_finance_city_plans_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_finance_city_plans_updated_at on public.finance_city_plans;
create trigger trg_finance_city_plans_updated_at
  before update on public.finance_city_plans
  for each row execute function public.touch_finance_city_plans_updated_at();

-- ----------------------------------------------------------------------------
-- 7) Forçar reload do PostgREST (para que ele "veja" as tabelas novas)
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ============================================================================
-- Verificação final — 1 linha; todas as colunas devem ser true / com valor
-- ============================================================================
select
  exists(select 1 from information_schema.tables
         where table_schema='public' and table_name='campaign_finance_config') as tem_config,
  exists(select 1 from information_schema.tables
         where table_schema='public' and table_name='finance_revenues')        as tem_revenues,
  exists(select 1 from information_schema.tables
         where table_schema='public' and table_name='finance_city_plans')      as tem_city_plans,
  (select count(*) from pg_policies
   where schemaname='public'
     and tablename in ('campaign_finance_config','finance_revenues','finance_city_plans')) as total_policies,
  (select count(*) from information_schema.role_table_grants
   where table_schema='public'
     and table_name in ('campaign_finance_config','finance_revenues','finance_city_plans')
     and grantee='authenticated')                                              as total_grants;
-- Esperado: tem_config=true, tem_revenues=true, tem_city_plans=true,
--           total_policies=3, total_grants=12 (4 privs × 3 tabelas)
