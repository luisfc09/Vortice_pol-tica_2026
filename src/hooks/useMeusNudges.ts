// ============================================================================
// useMeusNudges — nudges pessoais do usuário logado pra Central de Alertas.
// ----------------------------------------------------------------------------
// Resolve o nó do usuário em `supporters` (mesma pegadinha do useMySupporter:
// created_by === session.id E email match) e computa os nudges via
// computeNudges(). Guarda a última posição no ranking em localStorage pra
// detectar "alguém te ultrapassou" entre visitas.
//
// Não persiste nada no banco — é 100% derivado das coleções já carregadas.
// ============================================================================

import { useEffect, useMemo } from 'react';
import { collections, useCollection, useCollectionHydrated } from '@/lib/data';
import { useEffectiveSession } from '@/hooks/useEffectiveSession';
import { computeNudges, type Nudge } from '@/lib/nudges';
import type { Supporter } from '@/types';

interface UseMeusNudgesResult {
  nudges: Nudge[];
  /** Coleção de supporters já terminou a carga inicial. */
  hydrated: boolean;
  /** Usuário logado tem nó em supporters (constrói rede). */
  hasSupporter: boolean;
}

export function useMeusNudges(): UseMeusNudgesResult {
  const session = useEffectiveSession();
  const supporters = useCollection(collections.supporters);
  const hydrated = useCollectionHydrated(collections.supporters);

  const me = useMemo<Supporter | null>(() => {
    if (!session?.id) return null;
    const email = session.email?.toLowerCase().trim();
    if (!email) return null;
    const mine = supporters.filter(
      (s) => s.created_by === session.id && s.email?.toLowerCase().trim() === email,
    );
    if (mine.length === 0) return null;
    return mine.reduce((oldest, s) =>
      +new Date(s.created_at) < +new Date(oldest.created_at) ? s : oldest,
    );
  }, [supporters, session?.id, session?.email]);

  const campaignId = session?.campaign?.id ?? null;
  const storageKey = me && campaignId ? `vortice.rank.${campaignId}.${me.id}` : null;

  const result = useMemo(() => {
    if (!me) return { nudges: [] as Nudge[], myPosition: null as number | null };
    let previousPosition: number | null = null;
    if (storageKey && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw != null ? Number.parseInt(raw, 10) : NaN;
      previousPosition = Number.isFinite(parsed) ? parsed : null;
    }
    return computeNudges({ me, supporters, now: new Date(), previousPosition });
    // storageKey inclui me.id + campaignId; supporters cobre mudanças de dado.
  }, [me, supporters, storageKey]);

  // Persiste a posição atual pra a próxima visita comparar (detecção de
  // "te ultrapassou"). Roda após o render, sem afetar o cálculo atual.
  useEffect(() => {
    if (!storageKey || result.myPosition == null) return;
    try {
      localStorage.setItem(storageKey, String(result.myPosition));
    } catch {
      /* localStorage indisponível (modo privado) — ignora */
    }
  }, [storageKey, result.myPosition]);

  return { nudges: result.nudges, hydrated, hasSupporter: me != null };
}
