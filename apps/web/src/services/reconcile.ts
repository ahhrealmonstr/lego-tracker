import { loadCollectionFromCloud, reconcileCollection, syncCollectionToCloud } from '@lego-tracker/core';
import { loadCollection, saveCollection } from './storage';
import { clearSyncQueue, loadSyncQueue } from './syncQueue';

export async function reconcile(): Promise<void> {
  const cloudResult = await loadCollectionFromCloud();
  if (!cloudResult) return; // not configured or unauthenticated — no-op

  const local = loadCollection();
  const merged = reconcileCollection(local, cloudResult.items, cloudResult.tombstoneIds);
  saveCollection(merged);

  const queue = loadSyncQueue();
  await syncCollectionToCloud(queue); // throws on network error — caller handles
  clearSyncQueue();
}
