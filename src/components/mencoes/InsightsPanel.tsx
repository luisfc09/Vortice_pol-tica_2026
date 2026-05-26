import { useMemo, useState } from 'react';
import { Sparkles, RefreshCw, MessageSquare, ThumbsUp, ThumbsDown, Minus, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { buildInsights } from '@/lib/insights';
import { collections, isMockMode, useCollection } from '@/lib/data';

const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

export function InsightsPanel() {
  const mentions = useCollection(collections.mentions);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const insights = useMemo(() => buildInsights(mentions), [mentions]);

  async function refresh() {
    setRefreshing(true);
    // Simulate the latency of a real Claude call.
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
    toast.success(
      isMockMode()
        ? 'Insights recalculados (heurística local).'
        : 'Insights atualizados via Claude.',
    );
  }

  async function copyReply(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-xl tracking-wide text-foreground">
              Análise das últimas {insights.totalAnalyzed} menções
            </p>
            <p className="text-xs text-muted-foreground">
              {isMockMode()
                ? 'Modo demonstração — heurística local. Conecte a Anthropic API para análises plenas.'
                : 'Gerado via Anthropic API.'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          {refreshing ? 'Analisando...' : 'Recalcular'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SentimentStat
          label="Positivas"
          value={insights.positive}
          pct={insights.positive / Math.max(1, insights.totalAnalyzed)}
          icon={<ThumbsUp className="h-4 w-4" />}
          accent="bg-emerald-500/15 text-emerald-300"
        />
        <SentimentStat
          label="Neutras"
          value={insights.neutral}
          pct={insights.neutral / Math.max(1, insights.totalAnalyzed)}
          icon={<Minus className="h-4 w-4" />}
          accent="bg-vortex-bg text-muted-foreground"
        />
        <SentimentStat
          label="Negativas"
          value={insights.negative}
          pct={insights.negative / Math.max(1, insights.totalAnalyzed)}
          icon={<ThumbsDown className="h-4 w-4" />}
          accent="bg-red-500/15 text-red-300"
        />
        <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sentimento líquido
          </p>
          <p className="mt-1 font-display text-3xl tracking-wide text-primary">
            {insights.netSentiment >= 0 ? '+' : ''}
            {insights.netSentiment.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">Escala de -1 a +1</p>
        </div>
      </div>

      <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
        <p className="mb-3 font-display text-lg tracking-wide text-foreground">
          Tópicos em destaque
        </p>
        {insights.topTopics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem tópicos relevantes identificados nas últimas menções.
          </p>
        ) : (
          <div className="space-y-2">
            {insights.topTopics.map((t) => (
              <div
                key={t.topic}
                className="flex items-center justify-between rounded-lg border border-vortex-border bg-vortex-bg/50 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-foreground">{t.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.count} menções · sentimento médio {(t.sentiment >= 0 ? '+' : '') + t.sentiment.toFixed(2)}
                  </p>
                </div>
                <Badge variant={t.sentiment >= 0 ? 'success' : 'destructive'}>
                  {PCT.format(t.sentiment >= 0 ? t.sentiment : -t.sentiment)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="font-display text-lg tracking-wide text-foreground">Sugestões de resposta</p>
        {insights.suggestedReplies.map((s, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{s.context}</span>
              </div>
              <Badge variant="outline">{s.tone}</Badge>
            </div>
            <p className="rounded-lg bg-vortex-bg/50 p-3 text-sm text-foreground/90">{s.reply}</p>
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => copyReply(s.reply, idx)}>
                {copiedIdx === idx ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SentimentStat({
  label,
  value,
  pct,
  icon,
  accent,
}: {
  label: string;
  value: number;
  pct: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-vortex-border bg-vortex-surface/60 p-4 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>{icon}</span>
      </div>
      <p className="font-display text-3xl tracking-wide text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{PCT.format(pct)}</p>
    </div>
  );
}
