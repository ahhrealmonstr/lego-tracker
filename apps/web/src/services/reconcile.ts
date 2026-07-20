import { loadCollectionFromCloud, reconcileCollection, syncCollectionToCloud } from '@lego-tracker/core';
import { loadCollection, saveCollection } from './storage';
import { loadSyncQueue, removeSyncedEntries } from './syncQueue';

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
  // Remove only the snapshot we actually sent; a mutation enqueued during the
  // await above has a different content key and is preserved for the next run.
  removeSyncedEntries(queue);
}
