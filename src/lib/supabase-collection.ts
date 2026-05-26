import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Collection, CollectionWrite, EntityWithId } from '@/lib/collection-types';

type Listener = () => void;

interface SupabaseCollectionOptions {
  // Tabelas onde queremos receber updates push em tempo real.
  realtime?: boolean;
  // Coluna usada para ordenar a lista local. Default: created_at desc.
  orderBy?: string;
  orderAscending?: boolean;
}

function tempUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Collection backed by a Supabase table. Reads are sync (snapshot from memory),
// hydrated on first subscribe + kept in sync via realtime. Writes update the
// snapshot optimistically and reconcile when the server responds.
export class SupabaseCollection<T extends EntityWithId> implements Collection<T> {
  private snapshot: T[] = [];
  private listeners = new Set<Listener>();
  private channel: RealtimeChannel | null = null;
  private hydrated = false;
  private hydrating: Promise<void> | null = null;

  private readonly realtime: boolean;
  private readonly orderBy: string;
  private readonly orderAscending: boolean;

  constructor(private readonly table: string, options: SupabaseCollectionOptions = {}) {
    this.realtime = options.realtime ?? true;
    this.orderBy = options.orderBy ?? 'created_at';
    this.orderAscending = options.orderAscending ?? false;
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    void this.ensureHydrated();
    return () => {
      this.listeners.delete(l);
    };
  };

  getSnapshot = (): T[] => this.snapshot;

  list(): T[] {
    return this.snapshot;
  }

  get(id: string): T | undefined {
    return this.snapshot.find((r) => r.id === id);
  }

  // Fire-and-forget write that returns an optimistic entity. UI keeps its
  // synchronous flow; failures roll back and show a toast.
  create({ data }: CollectionWrite<T>): T {
    const optimistic = {
      ...(data as object),
      id: tempUuid(),
      created_at: data.created_at ?? new Date().toISOString(),
    } as unknown as T;

    this.snapshot = [optimistic, ...this.snapshot];
    this.emit();

    void supabase
      .from(this.table)
      .insert(data as Record<string, unknown>)
      .select()
      .single()
      .then(({ data: row, error }) => {
        if (error || !row) {
          this.snapshot = this.snapshot.filter((r) => r.id !== optimistic.id);
          this.emit();
          // Postgres code 23505 = unique_violation. Acontece quando um
          // autodetector (ex.: useAlertas) tenta inserir um registro que
          // já existe via outro caminho. Não é erro de usuário — logamos
          // no console e seguimos.
          const isDuplicate =
            (error?.code as string | undefined) === '23505' ||
            /duplicate key|unique constraint/i.test(error?.message ?? '');
          if (!isDuplicate) {
            toast.error(
              `Falha ao salvar em ${this.table}: ${error?.message ?? 'erro desconhecido'}`,
            );
          } else {
            console.warn(
              `[${this.table}] insert ignorado por duplicate key: ${error?.message}`,
            );
          }
          return;
        }
        // Swap temp record with the canonical row from the server.
        this.snapshot = this.snapshot.map((r) => (r.id === optimistic.id ? (row as T) : r));
        this.emit();
      });

    return optimistic;
  }

  update(id: string, patch: Partial<T>): T | undefined {
    const before = this.snapshot.find((r) => r.id === id);
    if (!before) return undefined;
    const optimistic = { ...before, ...patch } as T;
    this.snapshot = this.snapshot.map((r) => (r.id === id ? optimistic : r));
    this.emit();

    void supabase
      .from(this.table)
      .update(patch as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single()
      .then(({ data: row, error }) => {
        if (error) {
          // Roll back
          this.snapshot = this.snapshot.map((r) => (r.id === id ? before : r));
          this.emit();
          toast.error(`Falha ao atualizar: ${error.message}`);
          return;
        }
        if (row) {
          this.snapshot = this.snapshot.map((r) => (r.id === id ? (row as T) : r));
          this.emit();
        }
      });

    return optimistic;
  }

  remove(id: string): void {
    const before = this.snapshot.find((r) => r.id === id);
    if (!before) return;
    this.snapshot = this.snapshot.filter((r) => r.id !== id);
    this.emit();

    void supabase
      .from(this.table)
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          this.snapshot = [before, ...this.snapshot];
          this.emit();
          toast.error(`Falha ao excluir: ${error.message}`);
        }
      });
  }

  // ----- private -----

  private async ensureHydrated(): Promise<void> {
    if (this.hydrated) return;
    if (this.hydrating) return this.hydrating;
    this.hydrating = this.hydrate();
    return this.hydrating;
  }

  private async hydrate(): Promise<void> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .order(this.orderBy, { ascending: this.orderAscending });
    if (error) {
      // RLS errors return empty for safety. Don't toast on hydration failures
      // (a user with no membership row will hit these on every collection).
      this.snapshot = [];
    } else {
      this.snapshot = (data ?? []) as T[];
    }
    this.hydrated = true;
    this.emit();
    if (this.realtime) {
      this.setupRealtime();
    }
  }

  private setupRealtime(): void {
    if (this.channel) return;
    this.channel = supabase
      .channel(`vortice-${this.table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: this.table },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as T;
            if (!this.snapshot.some((r) => r.id === row.id)) {
              this.snapshot = [row, ...this.snapshot];
              this.emit();
            }
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as T;
            this.snapshot = this.snapshot.map((r) => (r.id === row.id ? row : r));
            this.emit();
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old as T;
            this.snapshot = this.snapshot.filter((r) => r.id !== row.id);
            this.emit();
          }
        },
      )
      .subscribe();
  }

  // Called when the user logs out; clears local state so the next login
  // hydrates fresh data.
  reset(): void {
    this.snapshot = [];
    this.hydrated = false;
    this.hydrating = null;
    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
