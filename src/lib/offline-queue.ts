import type { FieldInterviewInput, QueuedInterview } from '@/types';

const STORAGE_KEY = 'vortice.interview-queue.v1';

function read(): QueuedInterview[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedInterview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: QueuedInterview[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getQueue(): QueuedInterview[] {
  return read();
}

export function enqueueInterview(
  input: FieldInterviewInput,
  campaignId: string,
  userId: string,
): QueuedInterview {
  const local: QueuedInterview = {
    ...input,
    local_id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    queued_at: new Date().toISOString(),
    campaign_id: campaignId,
    created_by: userId,
  };
  const next = [...read(), local];
  write(next);
  return local;
}

export function removeFromQueue(localId: string): void {
  write(read().filter((item) => item.local_id !== localId));
}

export function clearQueue(): void {
  write([]);
}
