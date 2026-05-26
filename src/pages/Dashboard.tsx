import { useMemo } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { MiniKpi } from '@/components/dashboard/MiniKpi';
import { RegistrationChart } from '@/components/dashboard/RegistrationChart';
import { RegionVotesChart } from '@/components/dashboard/RegionVotesChart';
import { CityRanking } from '@/components/dashboard/CityRanking';
import { EngagementDonut } from '@/components/dashboard/EngagementDonut';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { AlertsList } from '@/components/dashboard/AlertsList';
import { UpcomingEvents } from '@/components/dashboard/UpcomingEvents';
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

  const voteTarget = session?.campaign?.vote_target ?? 0;

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
    </div>
  );
}
