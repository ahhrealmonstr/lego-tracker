import type { SyncQueueEntry } from '@lego-tracker/core';

const QUEUE_KEY = 'brick-ledger.sync-queue.v1';

function getItemId(entry: SyncQueueEntry): string {
  return entry.type === 'upsert' ? entry.item.id : entry.itemId;
}

export function loadSyncQueue(): SyncQueueEntry[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSyncQueue(entries: SyncQueueEntry[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
}

export function enqueueMutation(entry: SyncQueueEntry): void {
  const queue = loadSyncQueue();
  const id = getItemId(entry);
  const filtered = queue.filter(e => getItemId(e) !== id);
  saveSyncQueue([...filtered, entry]);
}

export function clearSyncQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}
