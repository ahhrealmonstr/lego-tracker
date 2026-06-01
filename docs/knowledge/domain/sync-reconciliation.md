---
type: business_concept
domain: domain
tags: [sync, reconciliation, LWW, tombstones, multi-device]
related: [sync.ts, supabase.ts, reconcile.ts]
---

# Sync Reconciliation

The reconciliation domain is implemented in `packages/core/src/domain/sync.ts` as a pure function with no I/O.

## reconcileCollection

`reconcileCollection(local, remote, tombstoneIds)` merges a local `OwnedLegoItem[]` with a remote `OwnedLegoItem[]` and a list of deleted item IDs, returning the merged array.

### Rules applied in order

1. **Tombstone removal** — any local item whose `id` appears in `tombstoneIds` is dropped first. This must happen before the LWW merge; otherwise a locally-newer edit to a remotely-deleted item would resurrect it.
2. **Last-write-wins per item** — for each remote item, if `remote.updatedAt >= local.updatedAt` (or no local copy exists), the remote version wins. Local wins only if `local.updatedAt` is strictly newer. On equal timestamps, remote wins (tie-break).
3. **Local-only items preserved** — items in local but absent from remote are kept as-is (they are unsynced additions pending push).

### Why tombstones beat local edits

Tombstones represent a deletion that was confirmed on another device. A locally-newer edit means the item was modified after the last sync but before the deletion was received. The deletion wins because it was an intentional action on another device; the local edit would have been discarded had the user seen the deletion first.

## SyncQueueEntry

`SyncQueueEntry` (in `packages/core/src/types/lego.ts`) is a discriminated union buffering mutations for offline-safe push:

- `{ type: 'upsert'; item: OwnedLegoItem }` — an add or edit
- `{ type: 'delete'; itemId: string; deletedAt: string }` — a tombstone write

## SyncStatus

`SyncStatus` is `'idle' | 'syncing' | 'error' | 'offline'`. Drives the `SyncStatus` component in `apps/web/src/components/SyncStatus.tsx`.
