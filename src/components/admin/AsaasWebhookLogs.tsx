import { useEffect, useMemo, useState } from 'react';
import { Webhook, RefreshCcw, ArrowRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WebhookLog {
  id: string;
  event_type: string;
  asaas_payment_id: string | null;
  campaign_id: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  payload: { payment?: { value?: number } } | null;
  processed_at: string;
  error: string | null;
  campaign: { candidate_name: string } | null;
}

type Period = '7' | '30' | '90' | 'all';

const EVENT_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'outline'> = {
  PAYMENT_CONFIRMED: 'success',
  PAYMENT_RECEIVED: 'success',
  PAYMENT_OVERDUE: 'destructive',
  SUBSCRIPTION_DELETED: 'destructive',
  PAYMENT_REFUNDED: 'warning',
};

const KNOWN_EVENTS = [
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED',
  'SUBSCRIPTION_DELETED',
  'PAYMENT_DELETED',
];

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function AsaasWebhookLogs() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  async function load() {
    let q = supabase
      .from('asaas_webhook_logs')
      .select(
        'id, event_type, asaas_payment_id, campaign_id, status_anterior, status_novo, payload, processed_at, error, campaign:campaigns(candidate_name)',
      )
      .order('processed_at', { ascending: false })
      .limit(50);

    if (period !== 'all') {
      const since = new Date(Date.now() - Number(period) * 86400000).toISOString();
      q = q.gte('processed_at', since);
    }
    if (eventFilter !== 'all') q = q.eq('event_type', eventFilter);
    if (campaignFilter !== 'all') q = q.eq('campaign_id', campaignFilter);

    const { data, error } = await q;
    setLoading(false);
    if (error) {
      // RLS bloqueia não-super-admin — silencioso (a página é gated).
      return;
    }
    setLogs((data ?? []) as unknown as WebhookLog[]);
    setLastSync(new Date());
  }

  // Carga inicial + auto-refresh a cada 60s.
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, eventFilter, campaignFilter]);

  // Campanhas que aparecem nos logs (pro filtro).
  const campaignOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of logs) {
      if (l.campaign_id) map.set(l.campaign_id, l.campaign?.candidate_name ?? l.campaign_id.slice(0, 8));
    }
    return Array.from(map.entries());
  }, [logs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-sky-400" /> Webhooks Asaas
        </CardTitle>
        <CardDescription>
          Últimos 50 eventos de pagamento (ativação/suspensão automática).
          {lastSync ? (
            <span className="ml-1 inline-flex items-center gap-1 text-[11px]">
              <RefreshCcw className="h-3 w-3" /> atualizado {format(lastSync, 'HH:mm:ss')}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {KNOWN_EVENTS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue placeholder="Campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
              {campaignOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : logs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-vortex-border bg-vortex-surface/30 p-6 text-center text-sm text-muted-foreground">
            Nenhum evento de webhook no período. Os eventos aparecem aqui conforme o Asaas
            notifica pagamentos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">Data/hora</th>
                  <th className="px-2 py-2 text-left font-medium">Evento</th>
                  <th className="px-2 py-2 text-left font-medium">Campanha</th>
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                  <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Valor</th>
                  <th className="px-2 py-2 text-left font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const value = l.payload?.payment?.value;
                  return (
                    <tr key={l.id} className="border-t border-vortex-border/60">
                      <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">
                        {format(new Date(l.processed_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant={EVENT_VARIANT[l.event_type] ?? 'outline'} className="text-[10px]">
                          {l.event_type}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-xs text-foreground">
                        {l.campaign?.candidate_name ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {l.status_novo ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            {l.status_anterior ?? '?'}
                            <ArrowRight className="h-3 w-3" />
                            <span className="font-medium text-foreground">{l.status_novo}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">sem mudança</span>
                        )}
                      </td>
                      <td className="hidden px-2 py-2 text-right text-xs tabular-nums sm:table-cell">
                        {typeof value === 'number' ? fmtBRL(value) : '—'}
                      </td>
                      <td className="px-2 py-2">
                        {l.error ? (
                          <Badge variant="destructive" className="text-[10px]" title={l.error}>
                            ❌ Erro
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">
                            ✅ Processado
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
