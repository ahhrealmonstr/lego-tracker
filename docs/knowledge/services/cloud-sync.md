---
type: business_concept
domain: services
tags: [sync, supabase, cloud, offline, reconciliation]
related: [supabase.ts, reconcile.ts, syncQueue.ts, useSync.ts]
---

# Cloud Sync Services

Multi-device sync is implemented across four files: `packages/core/src/services/supabase.ts` (DB I/O), `apps/web/src/services/syncQueue.ts` (offline queue), `apps/web/src/services/reconcile.ts` (orchestration), and `apps/web/src/hooks/useSync.ts` (React lifecycle).

## loadCollectionFromCloud

`loadCollectionFromCloud()` in `supabase.ts` fetches all rows for the authenticated user from `user_collection` using a nested select `*, catalog_cache!item_id(*)` to reconstruct the full `OwnedLegoItem` in one query. Returns `{ items: OwnedLegoItem[], tombstoneIds: string[] }` — live rows (`deleted_at IS NULL`) become `items`; soft-deleted rows (`deleted_at IS NOT NULL`) contribute their `item_id` to `tombstoneIds`. Returns `null` if Supabase is not configured or the user is unauthenticated.

## syncCollectionToCloud

`syncCollectionToCloud(queue: SyncQueueEntry[])` in `supabase.ts` pushes a `SyncQueueEntry[]` to the cloud. Returns early if the queue is empty (no `createClient` call). Splits entries into upserts and deletes: upsert entries upsert rows with `added_at`, `updated_at`, `deleted_at: null`; delete entries call `update({ deleted_at })` scoped to `item_id` and `user_id`. Throws on network error — the caller (`reconcile`) is responsible for not clearing the queue when this throws.

## syncQueue

`apps/web/src/services/syncQueue.ts` buffers mutations in localStorage under `brick-ledger.sync-queue.v1`.

- `enqueueMutation(entry)` — deduplicates by item ID: a newer entry for the same ID replaces the older one. An `upsert` followed by a `delete` for the same item correctly leaves only the delete.
- `clearSyncQueue()` — only called after a successful push.
- Queue survives page reloads and tab closes.

## reconcile

`reconcile()` in `apps/web/src/services/reconcile.ts` runs the full cycle:
1. `loadCollectionFromCloud()` — returns early (no error) if null
2. `loadCollection()` from localStorage
3. `reconcileCollection(local, remote, tombstoneIds)` — pure merge
4. `saveCollection(merged)` — write merged result to localStorage
5. `syncCollectionToCloud(queue)` — push pending mutations
6. `clearSyncQueue()` — only on success

If step 5 throws, the queue is not cleared and the error propagates to `useSync` which sets status to `'error'`.

## useSync

`useSync()` in `apps/web/src/hooks/useSync.ts` manages the sync lifecycle in React:
- Calls `reconcile()` on mount if online
- Runs `setInterval` every 5 minutes (300,000 ms)
- Listens to `window` `online`/`offline` events: offline → status `'offline'`, pause interval; online → immediate reconcile, resume interval
- Returns `{ status: SyncStatus, triggerSync }` consumed by `App` and `SyncStatus` component

## Schema

`user_collection` has two sync-specific columns added in migration `20260601000000_sync_columns.sql`:
- `added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` — persists `OwnedLegoItem.addedAt`
- `deleted_at TIMESTAMPTZ` — tombstone; `NULL` = live item
