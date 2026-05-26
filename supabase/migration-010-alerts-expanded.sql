-- ============================================================================
-- Vórtice — migration 010 — Central de Alertas
-- Parte A: adicionar valores ao enum (precisa rodar antes do bloco principal)
-- Parte B: enum priority + colunas + index de dedup
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARTE A — extensão do enum alert_type
-- ---------------------------------------------------------------------------
alter type alert_type add value if not exists 'municipio_sem_visita';
alter type alert_type add value if not exists 'mencao_viral_negativa';
alter type alert_type add value if not exists 'lideranca_inativa';
alter type alert_type add value if not exists 'meta_municipio_baixa';
alter type alert_type add value if not exists 'evento_sem_confirmacao';
alter type alert_type add value if not exists 'cabo_sumido';
alter type alert_type add value if not exists 'spike_negativo_mencoes';
alter type alert_type add value if not exists 'municipio_sem_lideranca';
alter type alert_type add value if not exists 'meta_geral_critica';
alter type alert_type add value if not exists 'entrevistas_paradas';

-- ---------------------------------------------------------------------------
-- PARTE B — priority + colunas adicionais
-- ---------------------------------------------------------------------------
do $$ begin
  create type alert_priority as enum ('urgente', 'critico', 'atencao', 'info');
exception when duplicate_object then null; end $$;

alter table public.alerts
  add column if not exists priority alert_priority not null default 'info';
alter table public.alerts
  add column if not exists title text;
alter table public.alerts
  add column if not exists description text;
alter table public.alerts
  add column if not exists acao_sugerida text;
alter table public.alerts
  add column if not exists acao_label text;
alter table public.alerts
  add column if not exists acao_route text;
alter table public.alerts
  add column if not exists is_resolved boolean not null default false;
alter table public.alerts
  add column if not exists expires_at timestamptz;
alter table public.alerts
  add column if not exists dedup_key text;

-- Index parcial: garante que não exista mais de 1 alerta aberto (não-resolvido)
-- com a mesma dedup_key na mesma campanha. Permite que alertas resolvidos
-- voltem a aparecer no futuro (sem conflito).
create unique index if not exists alerts_dedup_open_idx
  on public.alerts (campaign_id, dedup_key)
  where dedup_key is not null and is_resolved = false;

create index if not exists alerts_priority_idx
  on public.alerts (campaign_id, priority, is_resolved, is_read);

-- ============================================================================
-- Verificação
-- ============================================================================
select
  case
    when exists (
      select 1 from information_schema.columns
      where table_name = 'alerts' and column_name = 'priority'
    )
    and exists (
      select 1 from information_schema.columns
      where table_name = 'alerts' and column_name = 'dedup_key'
    )
    then 'OK — migration 010 aplicada'
    else 'FALHA'
  end as status;
