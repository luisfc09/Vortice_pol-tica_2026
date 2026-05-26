import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { collections, useCollection } from '@/lib/data';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CollectResponse {
  ok: boolean;
  error?: string;
  provider?: string | null;
  sources?: Record<
    string,
    {
      fetched: number;
      inserted: number;
      skipped: number;
      errors: string[];
    }
  >;
}

export function CollectButton() {
  const mentions = useCollection(collections.mentions);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [lastStats, setLastStats] = useState<CollectResponse | null>(null);

  // Última menção coletada como timestamp de "última coleta"
  const lastMentionAt = useMemo(() => {
    if (mentions.length === 0) return null;
    const max = mentions.reduce<string | null>((acc, m) => {
      const t = m.created_at;
      return acc == null || t > acc ? t : acc;
    }, null);
    return max ? new Date(max) : null;
  }, [mentions]);

  // Tick pra atualizar "há X minutos" sem precisar mexer no estado
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function run() {
    setRunning(true);
    setLastStats(null);
    try {
      const { data, error } = await supabase.functions.invoke('collect-mentions', {
        body: {},
      });
      if (error) {
        toast.error(`Falha ao coletar: ${error.message}`);
        return;
      }
      const payload = data as CollectResponse;
      setLastStats(payload);
      if (payload.error) {
        toast.error(payload.error);
        return;
      }
      const total = Object.values(payload.sources ?? {}).reduce(
        (acc, s) => acc + s.inserted,
        0,
      );
      const skipped = Object.values(payload.sources ?? {}).reduce(
        (acc, s) => acc + s.skipped,
        0,
      );
      toast.success(
        total === 0
          ? `Sem menções novas (${skipped} já estavam no banco).`
          : `${total} menção${total > 1 ? 'ões' : ''} nova${total > 1 ? 's' : ''} coletada${total > 1 ? 's' : ''}.`,
      );
      setLastRun(new Date());
    } finally {
      setRunning(false);
    }
  }

  const referenceTime = lastRun ?? lastMentionAt;
  const totalErrors = lastStats
    ? Object.values(lastStats.sources ?? {}).reduce((acc, s) => acc + s.errors.length, 0)
    : 0;

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <Button onClick={run} disabled={running} variant="outline" size="sm">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {running ? 'Coletando…' : 'Coletar agora'}
      </Button>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {referenceTime ? (
          <span>
            Última coleta {formatDistanceToNow(referenceTime, { addSuffix: true, locale: ptBR })}
          </span>
        ) : (
          <span>Ainda não coletado</span>
        )}
        {lastStats?.provider ? (
          <Badge variant="outline">IA: {lastStats.provider}</Badge>
        ) : null}
        {lastStats?.sources
          ? Object.entries(lastStats.sources).map(([k, v]) => (
              <Badge
                key={k}
                variant={v.errors.length > 0 ? 'destructive' : v.inserted > 0 ? 'success' : 'secondary'}
                className="gap-1"
              >
                {v.errors.length > 0 ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                {k === 'twitter' ? 'X' : 'Google News'}: +{v.inserted}
                {v.skipped > 0 ? ` / ${v.skipped} dup` : ''}
              </Badge>
            ))
          : null}
        {totalErrors > 0 ? (
          <span className="text-red-300">
            {totalErrors} erro{totalErrors > 1 ? 's' : ''} — confira logs da função
          </span>
        ) : null}
      </div>
    </div>
  );
}
