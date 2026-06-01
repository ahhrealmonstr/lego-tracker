# Multi-Device State Reconciliation

## Summary

Extend the existing Supabase cloud sync with a full pull-merge-push reconciliation cycle so that collection edits made on one device appear on all other devices. Deletions are propagated via tombstones. Conflicts are resolved by last-write-wins per item using the existing `updatedAt` timestamp. Offline mutations are queued in `localStorage` and flushed on the next successful sync.

## Status

proposed

## Milestone

M3

---

## Requirements

- Changes made on device A appear on device B within one sync cycle (≤ 5 minutes)
- Deleting an item on any device removes it from all devices (tombstone propagation)
- Conflicting edits to the same item resolve to the version with the newer `updatedAt`
- Mutations made while offline are queued and pushed when connectivity returns
- An offline indicator is shown when `navigator.onLine` is false; a sync-error state is shown on failure
- If Supabase is not configured or the user is unauthenticated, the app functions normally with local-only state (no error shown)

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  UI layer (apps/web)                        │
│  ├── SyncStatus component (indicator)       │
│  └── useSync hook (orchestration + timer)   │
├─────────────────────────────────────────────┤
│  Service layer (apps/web/src/services)      │
│  ├── syncQueue.ts  (localStorage queue)     │
│  └── reconcile.ts  (pull → merge → push)    │
├─────────────────────────────────────────────┤
│  Core domain (packages/core)                │
│  ├── domain/sync.ts  (reconcileCollection)  │
│  └── services/supabase.ts  (+ pull fn)      │
├─────────────────────────────────────────────┤
│  Supabase                                   │
│  └── user_collection (+ added_at, deleted_at)│
└─────────────────────────────────────────────┘
```

---

## Schema Changes

New migration: `supabase/migrations/20260601000000_sync_columns.sql`

```sql
ALTER TABLE public.user_collection
  ADD COLUMN added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN deleted_at TIMESTAMPTZ;
```

- `added_at` — persists the `addedAt` field from `OwnedLegoItem` (currently lost on sync)
- `deleted_at` — tombstone; `NULL` = live item; non-null = deleted on some device

---

## New Types

In `packages/core/src/types/lego.ts`:

```typescript
type SyncQueueEntry =
  | { type: 'upsert'; item: OwnedLegoItem }
  | { type: 'delete'; itemId: string; deletedAt: string }

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'
```

---

## Core Domain — `packages/core/src/domain/sync.ts`

Pure function, no I/O:

```typescript
reconcileCollection(
  local: OwnedLegoItem[],
  remote: OwnedLegoItem[],
  tombstoneIds: string[]
): OwnedLegoItem[]
```

Rules applied in order:
1. Remove any local item whose `id` is in `tombstoneIds`
2. For each remote item: use remote if remote `updatedAt` ≥ local `updatedAt` (or no local copy); keep local if local is strictly newer. On equal timestamps remote wins (tie-break).
3. Preserve local-only items (not yet synced to remote)

Tombstone removal happens before the LWW merge — this prevents a locally-newer edit from resurrecting a remotely-deleted item.

---

## Supabase Service Changes — `packages/core/src/services/supabase.ts`

New function:

```typescript
loadCollectionFromCloud(): Promise<{ items: OwnedLegoItem[]; tombstoneIds: string[] } | null>
```

Fetches all rows for the authenticated user. Splits into live items (`deleted_at IS NULL`) and tombstone IDs (`deleted_at IS NOT NULL`). Returns `null` if unauthenticated or Supabase is not configured.

Updated `syncCollectionToCloud` to accept `SyncQueueEntry[]` instead of `OwnedLegoItem[]`, handling:
- `upsert` entries → upsert row with `added_at`, `updated_at`
- `delete` entries → upsert row with `deleted_at` set

---

## Sync Queue — `apps/web/src/services/syncQueue.ts`

Storage key: `brick-ledger.sync-queue.v1`

```typescript
loadSyncQueue(): SyncQueueEntry[]
saveSyncQueue(entries: SyncQueueEntry[]): void
enqueueMutation(entry: SyncQueueEntry): void  // deduplicates by itemId, newer wins
clearSyncQueue(): void
```

`enqueueMutation` replaces any existing entry for the same `itemId` so a user editing an item 10 times offline produces one push, not ten.

---

## Reconcile Orchestration — `apps/web/src/services/reconcile.ts`

```typescript
async function reconcile(): Promise<void>
```

Steps:
1. `loadCollectionFromCloud()` — returns early (no error) if null
2. `loadCollection()` from `storage.ts`
3. `reconcileCollection(local, remote, tombstoneIds)` from `domain/sync.ts`
4. `saveCollection(merged)`
5. `syncCollectionToCloud(queue)` with current sync queue
6. `clearSyncQueue()`

If step 5 fails, the queue is **not** cleared — it will be retried on the next cycle. The upsert is idempotent so replaying is safe.

---

## UI / Hook Layer

**`apps/web/src/hooks/useSync.ts`**

```typescript
function useSync(): { status: SyncStatus; triggerSync: () => void }
```

- On mount: if online, call `reconcile()` immediately
- `setInterval` every 5 minutes calls `reconcile()` — cleared on unmount
- `window` `online` event: resume interval + immediate `reconcile()`
- `window` `offline` event: set status `'offline'`, pause interval
- During reconcile: `'syncing'`; on success: `'idle'`; on error: `'error'`

Mounts at app root (once). Mutation sites call `enqueueMutation` directly — they are decoupled from the hook.

**`apps/web/src/components/SyncStatus.tsx`**

| Status | Display |
|---|---|
| `idle` | nothing |
| `syncing` | spinner + "Syncing…" |
| `offline` | "Offline — changes will sync when reconnected" |
| `error` | "Sync failed" + retry button |

---

## Error Handling

| Failure | Behaviour |
|---|---|
| Network error during reconcile | Status → `'error'`; queue and localStorage untouched; retried on next cycle |
| Unauthenticated / Supabase not configured | `reconcile()` returns early; status stays `'idle'`; no error shown |
| Partial push failure (pull succeeded, push failed) | Merged collection saved locally; queue not cleared; push retried next cycle |

---

## Testing

| File | What |
|---|---|
| `packages/core/src/domain/sync.test.ts` | Unit tests for `reconcileCollection`: remote-newer wins, local-newer wins, local-only preserved, tombstone removes, tombstone beats local-newer, empty inputs |
| `packages/core/src/services/supabase.test.ts` | Extend existing: `loadCollectionFromCloud` splits live/tombstone, returns null when unauthed, maps DB columns correctly |
| `apps/web/src/services/syncQueue.test.ts` | enqueue appends, deduplicates by itemId, clear empties, load returns [] when absent |

`useSync` and `SyncStatus` are covered by Playwright E2E — not unit-tested here.

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/20260601000000_sync_columns.sql` | new |
| `packages/core/src/types/lego.ts` | add `SyncQueueEntry`, `SyncStatus` |
| `packages/core/src/domain/sync.ts` | new — `reconcileCollection` |
| `packages/core/src/domain/sync.test.ts` | new |
| `packages/core/src/services/supabase.ts` | add `loadCollectionFromCloud`, update `syncCollectionToCloud` |
| `packages/core/src/services/supabase.test.ts` | extend |
| `packages/core/src/index.ts` | re-export new types and functions |
| `apps/web/src/services/syncQueue.ts` | new |
| `apps/web/src/services/syncQueue.test.ts` | new |
| `apps/web/src/services/reconcile.ts` | new |
| `apps/web/src/hooks/useSync.ts` | new |
| `apps/web/src/components/SyncStatus.tsx` | new |
| `apps/web/src/App.tsx` | wire `useSync`, render `SyncStatus`, call `enqueueMutation` at mutation sites |
