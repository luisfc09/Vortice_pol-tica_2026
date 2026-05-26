import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Map as MapIcon,
  Vote,
  Building2,
  Target,
  CalendarCheck,
  MapPin,
  Megaphone,
  MessageSquare,
  Plus,
  LayoutDashboard,
  Radar as RadarIcon,
  BellRing,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { MiniKpi } from '@/components/dashboard/MiniKpi';
import { RegistrationChart } from '@/components/dashboard/RegistrationChart';
import { RegionVotesChart } from '@/components/dashboard/RegionVotesChart';
import { CityRanking } from '@/components/dashboard/CityRanking';
import { EngagementDonut } from '@/components/dashboard/EngagementDonut';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { AlertsList } from '@/components/dashboard/AlertsList';
import { UpcomingEvents } from '@/components/dashboard/UpcomingEvents';
import { PulseGauge } from '@/components/dashboard/PulseGauge';
import { CampaignSignals } from '@/components/dashboard/CampaignSignals';
import { WeeklyRadar } from '@/components/dashboard/WeeklyRadar';
import { AlertsHistory } from '@/components/alerts/AlertsHistory';
import { useAlertas } from '@/hooks/useAlertas';
import { collections, useCollection } from '@/lib/data';
import {
  buildCityRanking,
  buildEngagementBreakdown,
  buildMiniKpis,
  buildRegionStats,
  buildRegistrationTimeline,
  computeMetrics,
  totalMunicipalitiesMG,
  totalRegionsMG,
  weeklyDelta,
} from '@/lib/metrics';
import { computePulse, computeRadar, computeSignals } from '@/lib/pulse';
import { useAuthStore } from '@/stores/auth';
import { firstName, greeting } from '@/lib/utils';

const NUM = new Intl.NumberFormat('pt-BR');

export default function DashboardPage() {
  const session = useAuthStore((s) => s.session);
  const supporters = useCollection(collections.supporters);
  const voters = useCollection(collections.voters);
  const interviews = useCollection(collections.interviews);
  const events = useCollection(collections.events);
  const mentions = useCollection(collections.mentions);
  const campaignUsers = useCollection(collections.campaign_users);

  const voteTarget = session?.campaign?.vote_target ?? 0;
  const activeMembers = useMemo(
    () => campaignUsers.filter((u) => u.is_active).length,
    [campaignUsers],
  );

  const metrics = useMemo(
    () => computeMetrics(supporters, voters, mentions, voteTarget),
    [supporters, voters, mentions, voteTarget],
  );
  const supportersDelta = useMemo(() => weeklyDelta(supporters), [supporters]);
  const apoiadoresDelta = useMemo(
    () =>
      weeklyDelta([
        ...supporters.filter((s) => s.role === 'apoiador'),
        ...voters.filter((v) => v.vote_intention === 'apoiador'),
      ]),
    [supporters, voters],
  );

  const timeline = useMemo(
    () => buildRegistrationTimeline(supporters, voters, 7),
    [supporters, voters],
  );
  const regionStats = useMemo(
    () => buildRegionStats(supporters, voters, voteTarget),
    [supporters, voters, voteTarget],
  );
  const ranking = useMemo(() => buildCityRanking(supporters, voters, 5), [supporters, voters]);
  const engagement = useMemo(() => buildEngagementBreakdown(events, interviews), [events, interviews]);
  const miniKpis = useMemo(() => buildMiniKpis(events, interviews), [events, interviews]);

  // Painel Estratégico --------------------------------------------------------
  const pulseInput = useMemo(
    () => ({
      supporters,
      voters,
      interviews,
      events,
      mentions,
      voteTarget,
      members: activeMembers,
    }),
    [supporters, voters, interviews, events, mentions, voteTarget, activeMembers],
  );
  const [refreshTick, setRefreshTick] = useState(0);
  const pulse = useMemo(() => computePulse(pulseInput), [pulseInput, refreshTick]);
  const signals = useMemo(() => computeSignals(pulseInput), [pulseInput, refreshTick]);
  const radar = useMemo(() => computeRadar(pulseInput), [pulseInput, refreshTick]);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());

  function refreshStrategic() {
    setRefreshTick((t) => t + 1);
    setUpdatedAt(new Date());
  }

  const { counts: alertCounts } = useAlertas();

  const hello = `${greeting()}, ${firstName(session?.profile.full_name) || 'time'}!`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-foreground">{hello}</h2>
          <p className="text-sm text-muted-foreground">
            Panorama da campanha {session?.campaign?.candidate_name} ·{' '}
            {session?.campaign?.office} {session?.campaign?.state}{' '}
            {session?.campaign?.election_year}
          </p>
        </div>
        <Button asChild variant="default">
          <Link to="/liderancas">
            <Plus className="h-4 w-4" /> Ação rápida
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutDashboard className="mr-1 h-4 w-4" />
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="strategic">
            <RadarIcon className="mr-1 h-4 w-4" />
            Painel Estratégico
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <BellRing className="mr-1 h-4 w-4" />
            Alertas
            {alertCounts.total > 0 ? (
              <span
                className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${
                  alertCounts.urgente > 0
                    ? 'bg-red-500 text-white'
                    : 'bg-amber-500 text-vortex-bg'
                }`}
              >
                {alertCounts.total}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 6 KPIs principais */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Lideranças"
              value={NUM.format(metrics.totalSupporters)}
              icon={Users}
              accent="primary"
              trendPct={supportersDelta.pct}
            />
            <KpiCard
              label="Municípios atendidos"
              value={`${metrics.municipalitiesCovered}/${totalMunicipalitiesMG()}`}
              hint={`${Math.round((metrics.municipalitiesCovered / totalMunicipalitiesMG()) * 100)}% de MG`}
              icon={Building2}
              accent="violet"
            />
            <KpiCard
              label="Regiões"
              value={`${metrics.regionsCovered}/${totalRegionsMG()}`}
              hint={`${Math.round((metrics.regionsCovered / totalRegionsMG()) * 100)}% cobertas`}
              icon={MapIcon}
              accent="warning"
            />
            <KpiCard
              label="Apoiadores"
              value={NUM.format(metrics.totalSupportersApoiadores)}
              icon={UserCheck}
              accent="success"
              trendPct={apoiadoresDelta.pct}
            />
            <KpiCard
              label="Estimativa de votos"
              value={NUM.format(metrics.estimatedVotes)}
              progress={metrics.targetProgress}
              progressLabel={
                voteTarget > 0 ? `Meta: ${NUM.format(voteTarget)}` : 'Sem meta definida'
              }
              icon={Vote}
              accent="primary"
            />
            <KpiCard
              label="Meta geral"
              value={`${Math.round(metrics.targetProgress * 100)}%`}
              hint="Progresso da campanha"
              icon={Target}
              accent="violet"
              progress={metrics.targetProgress}
            />
          </div>

          {/* Linha 2: gráficos e rankings */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <RegistrationChart data={timeline} periodLabel="Últimos 7 dias" />
            </div>
            <RegionVotesChart data={regionStats} />
            <CityRanking rows={ranking} />
          </div>

          {/* Linha 3: agenda e engajamento */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <EngagementDonut slices={engagement} totalLabel="Mix de atividades" />
            <UpcomingEvents />
          </div>

          {/* Linha 4: alertas e atividades */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AlertsList />
            <ActivityFeed />
          </div>

          {/* Mini KPIs do rodapé */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniKpi
              label="Reuniões"
              value={NUM.format(miniKpis.meetings.value)}
              trendPct={miniKpis.meetings.trendPct}
              icon={CalendarCheck}
              accent="violet"
            />
            <MiniKpi
              label="Visitas"
              value={NUM.format(miniKpis.visits.value)}
              trendPct={miniKpis.visits.trendPct}
              icon={MapPin}
              accent="lime"
            />
            <MiniKpi
              label="Eventos"
              value={NUM.format(miniKpis.events.value)}
              trendPct={miniKpis.events.trendPct}
              icon={Megaphone}
              accent="amber"
            />
            <MiniKpi
              label="Entrevistas"
              value={NUM.format(miniKpis.interviews.value)}
              trendPct={miniKpis.interviews.trendPct}
              icon={MessageSquare}
              accent="sky"
            />
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsHistory />
        </TabsContent>

        <TabsContent value="strategic" className="space-y-6">
          {/* Pulso + Sinais lado a lado em telas grandes */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <PulseGauge
                score={pulse}
                updatedAt={updatedAt}
                onRefresh={refreshStrategic}
              />
            </div>
            <div className="xl:col-span-3">
              <CampaignSignals signals={signals} onRefresh={refreshStrategic} />
            </div>
          </div>

          {/* Radar */}
          <WeeklyRadar data={radar} />

          {/* Detalhamento das dimensões do pulso */}
          <div className="rounded-xl border border-vortex-border bg-vortex-surface/40 p-5 backdrop-blur">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Como o pulso é calculado
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <DimensionRow
                label="Crescimento"
                value={pulse.dimensions.growth}
                weight={25}
              />
              <DimensionRow
                label="Cobertura"
                value={pulse.dimensions.coverage}
                weight={20}
              />
              <DimensionRow
                label="Sentimento"
                value={pulse.dimensions.sentiment}
                weight={25}
              />
              <DimensionRow
                label="Campo"
                value={pulse.dimensions.fieldActivity}
                weight={15}
              />
              <DimensionRow
                label="Meta"
                value={pulse.dimensions.targetProgress}
                weight={15}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface DimensionRowProps {
  label: string;
  value: number;
  weight: number;
}

function DimensionRow({ label, value, weight }: DimensionRowProps) {
  const v = Math.round(value);
  const color = v >= 80 ? '#A3E635' : v >= 60 ? '#F59E0B' : v >= 40 ? '#F97316' : '#EF4444';
  return (
    <div className="rounded-lg border border-vortex-border bg-vortex-bg/40 p-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">peso {weight}%</span>
      </div>
      <p className="font-display text-2xl tracking-wide" style={{ color }}>
        {v}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-vortex-bg">
        <div className="h-full" style={{ width: `${v}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
