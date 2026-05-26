import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MentionsFeed } from '@/components/mencoes/MentionsFeed';
import { InsightsPanel } from '@/components/mencoes/InsightsPanel';
import { isMockMode } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

export default function MencoesPage() {
  return (
    <div className="space-y-5">
      {isMockMode() ? (
        <div className="flex items-start gap-3 rounded-xl border border-vortex-border bg-vortex-surface/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-foreground">Modo demonstração</p>
            <p>
              Conecte a X API v2, Google News RSS e Anthropic API para coleta e análise reais. As
              menções abaixo são dados simulados.
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
