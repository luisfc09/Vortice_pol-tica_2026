// Persistent in-browser "database" used while VITE_USE_MOCKS=true.
// Each collection is stored under its own localStorage key so other tabs see
// updates via the `storage` event, and React components re-render through
// useSyncExternalStore.

import type { Collection, CollectionWrite, EntityWithId } from '@/lib/collection-types';

type Listener = () => void;

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class MockCollection<T extends EntityWithId> implements Collection<T> {
  private listeners = new Set<Listener>();
  private snapshot: T[];

  constructor(
    private readonly storageKey: string,
    seed: T[],
  ) {
    this.snapshot = this.read(seed);

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== this.storageKey) return;
        this.snapshot = this.read(seed);
        this.emit();
      });
    }
  }

  private read(seed: T[]): T[] {
    if (typeof window === 'undefined') return [...seed];
    const raw = window.localStorage.getItem(this.storageKey);
    if (raw == null) {
      window.localStorage.setItem(this.storageKey, JSON.stringify(seed));
      return [...seed];
    }
    try {
      const parsed = JSON.parse(raw) as T[];
      return Array.isArray(parsed) ? parsed : [...seed];
    } catch {
      return [...seed];
    }
  }

  private write(next: T[]): void {
    this.snapshot = next;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(this.storageKey, JSON.stringify(next));
    }
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = (): T[] => this.snapshot;

  list(): T[] {
    return this.snapshot;
  }

  get(id: string): T | undefined {
    return this.snapshot.find((row) => row.id === id);
  }

  create({ data }: CollectionWrite<T>): T {
    const now = new Date().toISOString();
    const next = {
      ...(data as object),
      id: uuid(),
      created_at: data.created_at ?? now,
    } as unknown as T;
    this.write([next, ...this.snapshot]);
    return next;
  }

  insertMany(rows: T[]): void {
    this.write([...rows, ...this.snapshot]);
  }

  update(id: string, patch: Partial<T>): T | undefined {
    let updated: T | undefined;
    const next = this.snapshot.map((row) => {
      if (row.id !== id) return row;
      updated = { ...row, ...patch };
      return updated;
    });
    if (updated) this.write(next);
    return updated;
  }

  remove(id: string): void {
    this.write(this.snapshot.filter((row) => row.id !== id));
  }

  reset(seed: T[]): void {
    this.write([...seed]);
  }
}
