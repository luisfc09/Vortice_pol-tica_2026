import { Link } from 'react-router-dom';
import { Info, Zap, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MentionsFeed } from '@/components/mencoes/MentionsFeed';
import { InsightsPanel } from '@/components/mencoes/InsightsPanel';
import { CollectButton } from '@/components/mencoes/CollectButton';
import { isMockMode } from '@/lib/data';

export default function MencoesPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-foreground">
            Monitor de menções
          </h2>
          <p className="text-sm text-muted-foreground">
            Feed com sentimento, insights e Resposta Rápida para crises.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <CollectButton />
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/mencoes/resposta-rapida">
                <Zap className="h-4 w-4" /> Resposta Rápida
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/mencoes/resposta-rapida/historico">
                <History className="h-4 w-4" /> Histórico
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {isMockMode() ? (
        <div className="flex items-start gap-3 rounded-xl border border-vortex-border bg-vortex-surface/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-foreground">Modo demonstração</p>
            <p>
              Conecte a X API v2, Google News RSS e provedores de IA em{' '}
              <Link to="/integracoes" className="underline">
                Integrações
              </Link>{' '}
              para coleta e análise reais. As menções abaixo são dados simulados.
            </p>
          </div>
          <Badge variant="warning" className="ml-auto shrink-0">
            mock
          </Badge>
        </div>
      ) : null}

      <Tabs defaultValue="feed">
        <TabsList>
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="feed">
          <MentionsFeed />
        </TabsContent>

        <TabsContent value="insights">
          <InsightsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
