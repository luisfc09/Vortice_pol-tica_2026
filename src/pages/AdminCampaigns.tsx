import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Shield,
  Building2,
  Users,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  XCircle,
  ChevronRight,
  Clock,
  Eye,
  RefreshCcw,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/data/EmptyState';
import { SearchBar } from '@/components/data/SearchBar';
import { FilterPill } from '@/components/data/FilterPill';
import { CampaignProvisionSheet } from '@/components/admin/CampaignProvisionSheet';
import { supabase } from '@/lib/supabase';
import { useViewAsStore } from '@/stores/viewAs';
import {
  CAMPAIGN_PLAN_LABEL,
  CAMPAIGN_STATUS_LABEL,
  type Campaign,
  type CampaignOverview,
  type CampaignStatus,
} from '@/types';

type StatusFilter = 'all' | CampaignStatus;

const NUM = new Intl.NumberFormat('pt-BR');
const DATE = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

const STATUS_VARIANT: Record<CampaignStatus, 'default' | 'secondary' | 'warning' | 'destructive'> = {
  trial: 'secondary',
  active: 'default',
  suspended: 'warning',
  cancelled: 'destructive',
};

const STATUS_ICON: Record<CampaignStatus, React.ComponentType<{ className?: string }>> = {
  trial: AlertTriangle,
  active: CheckCircle2,
  suspended: PauseCircle,
  cancelled: XCircle,
};

interface ExpiringRow {
  id: string;
  candidate_name: string;
  trial_ends_at: string;
  days_remaining: number;
}

export default function AdminCampaignsPage() {
  const navigate = useNavigate();
  const enterViewAs = useViewAsStore((s) => s.enter);
  const viewAsId = useViewAsStore((s) => s.campaign?.id ?? null);

  const [rows, setRows] = useState<CampaignOverview[]>([]);
  const [expiring, setExpiring] = useState<ExpiringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [runningExpire, setRunningExpire] = useState(false);
  const [runningReminders, setRunningReminders] = useState(false);

  // Entra no modo "ver como cliente": busca a campanha completa pelo id,
  // grava no view-as store e navega pra /dashboard — o useEffectiveSession
  // vai sobrescrever a session.campaign pra essa.
  async function enterAsClient(campaignId: string) {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (error || !data) {
      toast.error(`Falha ao entrar como cliente: ${error?.message ?? 'sem dados'}`);
      return;
    }
    enterViewAs(data as Campaign);
    toast.success(`Visualizando como ${data.candidate_name}.`);
    navigate('/dashboard');
  }

  async function load() {
    setLoading(true);
    const [{ data, error }, { data: exp }] = await Promise.all([
      supabase.rpc('list_campaigns_overview'),
      supabase.rpc('trial_campaigns_expiring', { p_days: 7 }),
    ]);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as CampaignOverview[]);
    setExpiring((exp ?? []) as ExpiringRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function extendTrial(id: string, days: number) {
    const next = new Date();
    next.setDate(next.getDate() + days);
    const { error } = await supabase
      .from('campaigns')
      .update({ trial_ends_at: next.toISOString() })
      .eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Trial estendido em ${days} dias.`);
    void load();
  }

  async function runExpireNow() {
    setRunningExpire(true);
    try {
      const { data, error } = await supabase.rpc('expire_trial_campaigns');
      if (error) {
        toast.error(error.message);
        return;
      }
      const count = (data as Array<unknown> | null)?.length ?? 0;
      toast.success(
        count === 0
          ? 'Nenhum trial estava vencido.'
          : `${count} campanha${count > 1 ? 's' : ''} suspensa${count > 1 ? 's' : ''}.`,
      );
      void load();
    } finally {
      setRunningExpire(false);
    }
  }

  async function runDueRemindersNow() {
    setRunningReminders(true);
    try {
      const { data, error } = await supabase.rpc('run_due_reminders_now');
      if (error) {
        toast.error(error.message);
        return;
      }
      const count = (data as Array<unknown> | null)?.length ?? 0;
      toast.success(
        count === 0
          ? 'Nenhum aviso de vencimento pra enviar hoje.'
          : `${count} aviso${count > 1 ? 's' : ''} de vencimento disparado${count > 1 ? 's' : ''}.`,
      );
    } finally {
      setRunningReminders(false);
    }
  }

  async function changeStatus(id: string, status: CampaignStatus) {
    const { error } = await supabase
      .from('campaigns')
      .update({ status })
      .eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Status atualizado para ${CAMPAIGN_STATUS_LABEL[status]}.`);
    void load();
  }

  const filtered = rows
    .filter((r) => filter === 'all' || r.status === filter)
    .filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return `${r.candidate_name} ${r.party} ${r.party_number} ${r.state}`
        .toLowerCase()
        .includes(q);
    });

  const counts: Record<StatusFilter, number> = {
    all: rows.length,
    trial: rows.filter((r) => r.status === 'trial').length,
    active: rows.filter((r) => r.status === 'active').length,
    suspended: rows.filter((r) => r.status === 'suspended').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
  };

  const totalSupporters = rows.reduce((acc, r) => acc + Number(r.supporters_count ?? 0), 0);
  const totalVoters = rows.reduce((acc, r) => acc + Number(r.voters_count ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Shield className="h-4 w-4 text-vortex-violet" />
            <span className="text-xs uppercase tracking-widest text-vortex-violet">
              Admin Vórtice
            </span>
          </div>
          <h2 className="font-display text-3xl tracking-wide text-foreground">
            Campanhas do SaaS
          </h2>
          <p className="text-sm text-muted-foreground">
            {counts.active} ativas · {counts.trial} em trial · {counts.suspended} suspensas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={runExpireNow} disabled={runningExpire}>
            {runningExpire ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {runningExpire ? 'Processando…' : 'Rodar expirar trials agora'}
          </Button>
          <Button variant="outline" size="sm" onClick={runDueRemindersNow} disabled={runningReminders}>
            {runningReminders ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {runningReminders ? 'Enviando…' : 'Rodar régua agora'}
          </Button>
          <Button onClick={() => setProvisionOpen(true)}>
            <Plus className="h-4 w-4" /> Nova campanha
          </Button>
        </div>
      </div>

      {/* KPIs do SaaS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SaaSKpi label="Campanhas" value={counts.all} icon={Building2} accent="violet" />
        <SaaSKpi label="Ativas" value={counts.active} icon={CheckCircle2} accent="lime" />
        <SaaSKpi label="Lideranças (total)" value={NUM.format(totalSupporters)} icon={Users} accent="violet" />
        <SaaSKpi label="Eleitores (total)" value={NUM.format(totalVoters)} icon={UserCheck} accent="lime" />
      </div>

      {expiring.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 backdrop-blur">
          <div className="mb-3 flex items-center gap-2 text-amber-300">
            <Clock className="h-4 w-4" />
            <p className="font-semibold">
              {expiring.length} trial{expiring.length > 1 ? 's' : ''} expira{expiring.length > 1 ? 'm' : ''} nos próximos 7 dias
            </p>
          </div>
          <ul className="space-y-2">
            {expiring.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-vortex-bg/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/admin/campaigns/${row.id}`}
                    className="truncate font-medium text-foreground hover:text-primary"
                  >
                    {row.candidate_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {row.days_remaining === 0
                      ? 'expira hoje'
                      : row.days_remaining === 1
                        ? 'expira amanhã'
                        : `expira em ${row.days_remaining} dias`}
                    {' · '}
                    {DATE.format(new Date(row.trial_ends_at))}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => extendTrial(row.id, 7)}>
                    +7 dias
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => extendTrial(row.id, 30)}>
                    +30 dias
                  </Button>
                  <Button size="sm" onClick={() => changeStatus(row.id, 'active')}>
                    Ativar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Buscar por candidato, partido, UF"
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        <FilterPill label="Todas" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
        {(Object.keys(CAMPAIGN_STATUS_LABEL) as CampaignStatus[]).map((s) => (
          <FilterPill
            key={s}
            label={CAMPAIGN_STATUS_LABEL[s]}
            count={counts[s]}
            active={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando campanhas...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sem campanhas"
          description="Provisione a primeira instância do SaaS."
          icon={<Building2 className="h-5 w-5" />}
          action={
            <Button onClick={() => setProvisionOpen(true)}>
              <Plus className="h-4 w-4" /> Nova campanha
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => {
            const StatusIcon = STATUS_ICON[r.status];
            return (
              <li
                key={r.id}
                className="flex flex-col gap-4 rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur lg:flex-row lg:items-center"
              >
                <Link
                  to={`/admin/campaigns/${r.id}`}
                  className="flex flex-1 min-w-0 items-start gap-3 hover:opacity-90"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-vortex-violet/15 text-vortex-violet">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-foreground">{r.candidate_name}</p>
                      <Badge variant={STATUS_VARIANT[r.status]} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {CAMPAIGN_STATUS_LABEL[r.status]}
                      </Badge>
                      <Badge variant="outline">{CAMPAIGN_PLAN_LABEL[r.plan]}</Badge>
                      {r.id === viewAsId ? (
                        <Badge variant="success" className="gap-1">
                          <Eye className="h-3 w-3" />
                          Vendo agora
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.party} {r.party_number} · {r.office} {r.state} {r.election_year} ·
                      Criada em {DATE.format(new Date(r.created_at))}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        <span className="text-foreground">{r.members_count}</span> membros
                      </span>
                      <span>
                        <span className="text-foreground">{NUM.format(Number(r.supporters_count ?? 0))}</span>{' '}
                        lideranças
                      </span>
                      <span>
                        <span className="text-foreground">{NUM.format(Number(r.voters_count ?? 0))}</span>{' '}
                        eleitores
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="hidden h-4 w-4 shrink-0 self-center text-muted-foreground lg:block" />
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={r.id === viewAsId ? 'default' : 'outline'}
                    onClick={() => void enterAsClient(r.id)}
                    title="Visualizar o sistema como admin desta campanha"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {r.id === viewAsId ? 'Continuar vendo' : 'Ver como cliente'}
                  </Button>
                  {r.status !== 'active' ? (
                    <Button size="sm" onClick={() => changeStatus(r.id, 'active')}>
                      Ativar
                    </Button>
                  ) : null}
                  {r.status === 'active' || r.status === 'trial' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changeStatus(r.id, 'suspended')}
                    >
                      Suspender
                    </Button>
                  ) : null}
                  {r.status !== 'cancelled' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-300 hover:text-red-200"
                      onClick={() => changeStatus(r.id, 'cancelled')}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CampaignProvisionSheet
        open={provisionOpen}
        onOpenChange={setProvisionOpen}
        onCreated={load}
      />
    </div>
  );
}

interface SaaSKpiProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'lime' | 'violet';
}

function SaaSKpi({ label, value, icon: Icon, accent }: SaaSKpiProps) {
  const color = accent === 'lime' ? 'text-vortex-lime bg-vortex-lime/10' : 'text-vortex-violet bg-vortex-violet/15';
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="font-display text-3xl tracking-wide text-foreground">{value}</p>
    </div>
  );
}
