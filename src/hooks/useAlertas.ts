import { useCallback, useEffect, useMemo, useRef } from 'react';
import { collections, useCollection } from '@/lib/data';
import { useAuthStore } from '@/stores/auth';
import { detectAll, bucketByPriority, type AlertDraft } from '@/lib/alertDetector';
import type { Alert, AlertPriority } from '@/types';

const DETECTION_INTERVAL_MS = 30 * 60 * 1000;
// Delay até a primeira detecção. Dá tempo das coleções (alerts, supporters,
// voters, interviews, …) hidratarem do Supabase — sem isso, o set de
// dedup_keys "abertos" fica vazio e tentamos inserir alertas que JÁ existem
// no banco, batendo no índice único alerts_dedup_open_idx.
const INITIAL_DETECTION_DELAY_MS = 2500;

export function useAlertas() {
  const session = useAuthStore((s) => s.session);
  const supporters = useCollection(collections.supporters);
  const voters = useCollection(collections.voters);
  const interviews = useCollection(collections.interviews);
  const events = useCollection(collections.events);
  const mentions = useCollection(collections.mentions);
  const alerts = useCollection(collections.alerts);
  const members = useCollection(collections.campaign_users);

  const voteTarget = session?.campaign?.vote_target ?? 0;

  const runRef = useRef<() => void>(() => undefined);

  const runDetection = useCallback(() => {
    if (!session?.campaign) return;
    const drafts = detectAll({
      supporters,
      voters,
      interviews,
      events,
      mentions,
      members,
      voteTarget,
    });
    // Mapa de dedup_keys já abertos (não-resolvidos) pra evitar inserir duplicata
    const openKeys = new Set(
      alerts.filter((a) => !a.is_resolved && a.dedup_key).map((a) => a.dedup_key as string),
    );
    const toInsert: AlertDraft[] = drafts.filter(
      (d) => d.dedup_key && !openKeys.has(d.dedup_key),
    );
    if (toInsert.length === 0) return;

    for (const d of toInsert) {
      collections.alerts.create({
        data: {
          campaign_id: session.campaign.id,
          type: d.type,
          priority: d.priority,
          title: d.title,
          description: d.description,
          acao_sugerida: d.acao_sugerida,
          acao_label: d.acao_label,
          acao_route: d.acao_route,
          meta: d.meta,
          dedup_key: d.dedup_key,
          message: d.message ?? d.title ?? '',
          is_read: false,
          is_resolved: false,
          expires_at: d.expires_at ?? null,
        },
      });
    }
  }, [
    session?.campaign,
    supporters,
    voters,
    interviews,
    events,
    mentions,
    members,
    alerts,
    voteTarget,
  ]);

  // Mantém referência atual em ref para o setInterval não disparar reset
  runRef.current = runDetection;

  useEffect(() => {
    if (!session?.campaign) return;
    // Primeiro disparo com delay (espera hidratação). Os disparos
    // seguintes seguem o intervalo normal.
    const first = window.setTimeout(
      () => runRef.current(),
      INITIAL_DETECTION_DELAY_MS,
    );
    const id = window.setInterval(() => runRef.current(), DETECTION_INTERVAL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [session?.campaign?.id]);

  const open = useMemo(
    () => alerts.filter((a) => !a.is_resolved),
    [alerts],
  );
  const unread = useMemo(() => open.filter((a) => !a.is_read), [open]);
  const byPriority = useMemo(() => bucketByPriority(open), [open]);
  const buckets: Record<AlertPriority, Alert[]> = byPriority;

  const counts: Record<AlertPriority | 'total' | 'unread', number> = {
    urgente: byPriority.urgente.length,
    critico: byPriority.critico.length,
    atencao: byPriority.atencao.length,
    info: byPriority.info.length,
    total: open.length,
    unread: unread.length,
  };

  const markRead = useCallback((id: string) => {
    collections.alerts.update(id, { is_read: true });
  }, []);

  const markResolved = useCallback((id: string) => {
    collections.alerts.update(id, { is_resolved: true, is_read: true });
  }, []);

  const markAllRead = useCallback(() => {
    for (const a of unread) {
      collections.alerts.update(a.id, { is_read: true });
    }
  }, [unread]);

  return {
    alerts,
    open,
    unread,
    buckets,
    counts,
    runDetection,
    markRead,
    markResolved,
    markAllRead,
  };
}
