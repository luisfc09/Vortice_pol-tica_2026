// Façade over Supabase + the mock collections. Components use these
// helpers instead of touching either backend directly, so swapping to a real
// Supabase project is a matter of flipping VITE_USE_MOCKS=false.

import { useSyncExternalStore } from 'react';
import { MockCollection } from '@/lib/mock-db';
import { SupabaseCollection } from '@/lib/supabase-collection';
import type { Collection, EntityWithId } from '@/lib/collection-types';
import { USE_MOCKS } from '@/lib/supabase';
// re-export for callers that want to type a Collection ref
export type { Collection } from '@/lib/collection-types';
import { supabase } from '@/lib/supabase';
import { clearQueue, getQueue, removeFromQueue } from '@/lib/offline-queue';
import {
  SEED_ALERTS,
  SEED_CAMPAIGN_USERS,
  SEED_EVENTS,
  SEED_INTERVIEWS,
  SEED_MENTIONS,
  SEED_SUPPORTERS,
  SEED_VOTERS,
} from '@/data/seeds';
import type {
  Alert,
  CampaignEvent,
  CampaignUser,
  FieldInterview,
  Mention,
  MentionResponse,
  Supporter,
  Voter,
} from '@/types';

interface CollectionConfig<T extends EntityWithId> {
  table: string;
  seed: T[];
}

function build<T extends EntityWithId>({ table, seed }: CollectionConfig<T>): Collection<T> {
  if (USE_MOCKS) {
    return new MockCollection<T>(`vortice.db.${table}.v1`, seed);
  }
  return new SupabaseCollection<T>(table);
}

export const collections = {
  supporters: build<Supporter>({ table: 'supporters', seed: SEED_SUPPORTERS }),
  voters: build<Voter>({ table: 'voters', seed: SEED_VOTERS }),
  interviews: build<FieldInterview>({ table: 'field_interviews', seed: SEED_INTERVIEWS }),
  events: build<CampaignEvent>({ table: 'events', seed: SEED_EVENTS }),
  mentions: build<Mention>({ table: 'mentions', seed: SEED_MENTIONS }),
  alerts: build<Alert>({ table: 'alerts', seed: SEED_ALERTS }),
  campaign_users: build<CampaignUser>({ table: 'campaign_users', seed: SEED_CAMPAIGN_USERS }),
  mention_responses: build<MentionResponse>({ table: 'mention_responses', seed: [] }),
};

export function useCollection<T extends EntityWithId>(collection: Collection<T>): T[] {
  return useSyncExternalStore(collection.subscribe, collection.getSnapshot, collection.getSnapshot);
}

export function isMockMode(): boolean {
  return USE_MOCKS;
}

export interface FlushResult {
  succeeded: number;
  failed: number;
  errors: string[];
}

function nullIfBlank(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// Promove entrevistas enfileiradas no localStorage para o backend persistente.
// Espera cada INSERT terminar antes de remover o item da fila — assim um erro
// (FK violation, RLS, offline) NÃO descarta o registro silenciosamente.
//
// Retorna contagem de sucesso/falha + mensagens dos erros pra exibir ao usuário.
export async function flushInterviewQueue(): Promise<FlushResult> {
  const queue = getQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0, errors: [] };

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of queue) {
    const payload = {
      campaign_id: item.campaign_id,
      voter_name: item.voter_name,
      voter_phone: nullIfBlank(item.voter_phone),
      municipality_code: nullIfBlank(item.municipality_code),
      neighborhood: nullIfBlank(item.neighborhood),
      vote_intention: item.vote_intention,
      receptivity_score: item.receptivity_score,
      priority_themes: item.priority_themes,
      vote_decided: item.vote_decided,
      notes: nullIfBlank(item.notes),
      lat: item.lat,
      lng: item.lng,
      created_by: item.created_by,
      created_at: item.queued_at,
    };

    try {
      if (USE_MOCKS) {
        // Mock é síncrono — não há como falhar.
        // Cast pra evitar exigir todos os campos novos do questionário
        // aprofundado (são todos NULL por default no mock).
        collections.interviews.create({ data: payload } as never);
      } else {
        const { error } = await supabase.from('field_interviews').insert(payload);
        if (error) throw new Error(error.message);
      }
      removeFromQueue(item.local_id);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      errors.push(`${item.voter_name}: ${msg}`);
    }
  }

  return { succeeded, failed, errors };
}

// Limpa a fila offline forçadamente — usado quando o usuário decide
// descartar entrevistas que estão falhando há repetidas tentativas.
export function discardInterviewQueue(): number {
  const count = getQueue().length;
  clearQueue();
  return count;
}

// Insere uma entrevista no banco e devolve o ID real (server-generated).
// Usado pelo fluxo "Salvar e aprofundar" — precisa do id pra navegar
// pra /campo/entrevista/:id/questionario imediatamente.
//
// Bypassa a fila offline porque o questionário aprofundado precisa de
// conexão (chama IA, atualiza linha existente). Se estiver offline, o
// usuário deve usar "Salvar rápido".
export async function createInterviewReturningId(
  data: Record<string, unknown>,
): Promise<string> {
  if (USE_MOCKS) {
    // MockCollection.create é síncrono e retorna o objeto com id.
    const row = collections.interviews.create({ data } as never);
    return row.id;
  }
  const { data: inserted, error } = await supabase
    .from('field_interviews')
    .insert(data)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  if (!inserted?.id) throw new Error('Insert sem id retornado.');
  return inserted.id as string;
}

// Called by useAuth on signout so the next user lands on clean local state.
export function resetCollections(): void {
  for (const c of Object.values(collections)) {
    if (c instanceof SupabaseCollection) {
      c.reset();
    }
  }
}
