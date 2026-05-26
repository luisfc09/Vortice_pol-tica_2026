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
import { clearQueue, getQueue } from '@/lib/offline-queue';
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
};

export function useCollection<T extends EntityWithId>(collection: Collection<T>): T[] {
  return useSyncExternalStore(collection.subscribe, collection.getSnapshot, collection.getSnapshot);
}

export function isMockMode(): boolean {
  return USE_MOCKS;
}

// Promotes queued interviews into the persistent collection. Returns the
// number of records that were committed.
export function flushInterviewQueue(): number {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  for (const item of queue) {
    collections.interviews.create({
      data: {
        campaign_id: item.campaign_id,
        voter_name: item.voter_name,
        voter_phone: item.voter_phone || null,
        municipality_code: item.municipality_code || null,
        neighborhood: item.neighborhood || null,
        vote_intention: item.vote_intention,
        receptivity_score: item.receptivity_score,
        priority_themes: item.priority_themes,
        vote_decided: item.vote_decided,
        notes: item.notes || null,
        lat: item.lat,
        lng: item.lng,
        created_by: item.created_by,
        created_at: item.queued_at,
      },
    });
  }
  clearQueue();
  return queue.length;
}

// Called by useAuth on signout so the next user lands on clean local state.
export function resetCollections(): void {
  for (const c of Object.values(collections)) {
    if (c instanceof SupabaseCollection) {
      c.reset();
    }
  }
}
