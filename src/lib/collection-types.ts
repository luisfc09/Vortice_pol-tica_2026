// Interface compartilhada entre MockCollection e SupabaseCollection.
// O código de UI fala com qualquer um sem saber a diferença.

export type EntityWithId = { id: string };

export interface CollectionWrite<T> {
  data: Omit<T, 'id' | 'created_at'> & { created_at?: string };
}

export interface Collection<T extends EntityWithId> {
  subscribe: (l: () => void) => () => void;
  getSnapshot: () => T[];
  list: () => T[];
  get: (id: string) => T | undefined;
  create: (input: CollectionWrite<T>) => T;
  update: (id: string, patch: Partial<T>) => T | undefined;
  remove: (id: string) => void;
}
