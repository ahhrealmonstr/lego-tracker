import { loadCollectionFromCloud, reconcileCollection, syncCollectionToCloud } from '@lego-tracker/core';
import { loadCollection, saveCollection } from './storage';
import { clearSyncQueue, loadSyncQueue } from './syncQueue';

let inFlight: Promise<void> | null = null;

// Single-flight guard: concurrent triggers (interval + online + manual) await the
// same run instead of interleaving load/save on the shared localStorage collection.
export function reconcile(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = doReconcile().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doReconcile(): Promise<void> {
  const cloudResult = await loadCollectionFromCloud();
  if (!cloudResult) return; // not configured or unauthenticated — no-op

  const local = loadCollection();
  const merged = reconcileCollection(local, cloudResult.items, cloudResult.tombstoneIds);
  saveCollection(merged);

  const queue = loadSyncQueue();
  await syncCollectionToCloud(queue); // throws on network error — caller handles
  clearSyncQueue();
}
