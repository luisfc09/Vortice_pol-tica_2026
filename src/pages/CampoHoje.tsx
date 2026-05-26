import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Sunrise } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TodayVisitsMap } from '@/components/campo/TodayVisitsMap';
import { TodaySentimentPanel } from '@/components/campo/TodaySentimentPanel';
import { TodayThemesPanel } from '@/components/campo/TodayThemesPanel';
import { TodayTeamRanking } from '@/components/campo/TodayTeamRanking';
import { collections, useCollection } from '@/lib/data';
import {
  computeAgentRanking,
  computeSentiment,
  computeThemes,
  type Period,
} from '@/lib/campo-hoje';

export default function CampoHojePage() {
  const interviews = useCollection(collections.interviews);
  const [period, setPeriod] = useState<Period>('today');
  const [refreshKey, setRefreshKey] = useState(0);

  const sentiment = useMemo(() => computeSentiment(interviews), [interviews, refreshKey]);
  const themes = useMemo(() => computeThemes(interviews, 5), [interviews, refreshKey]);
  const ranking = useMemo(() => computeAgentRanking(interviews, 5), [interviews, refreshKey]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/campo">
              <ArrowLeft className="h-4 w-4" /> Voltar ao Campo
            </Link>
          </Button>
          <div className="mb-1 flex items-center gap-2">
            <Sunrise className="h-4 w-4 text-vortex-lime" />
            <span className="text-xs uppercase tracking-widest text-vortex-lime">
              Painel de operação
            </span>
          </div>
          <h2 className="font-display text-3xl tracking-wide text-foreground">
            Campo Hoje
          </h2>
          <p className="text-sm text-muted-foreground">
            Visão em tempo real do que aconteceu em campo hoje · {sentiment.total}{' '}
            entrevista{sentiment.total === 1 ? '' : 's'} registrada
            {sentiment.total === 1 ? '' : 's'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="h-4 w-4" /> Recalcular
        </Button>
      </div>

      <TodayVisitsMap
        interviews={interviews}
        period={period}
        onChangePeriod={setPeriod}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TodaySentimentPanel data={sentiment} />
        <TodayThemesPanel themes={themes} />
      </div>

      <TodayTeamRanking rows={ranking} />
    </div>
  );
}
