---
feature: cloud-backup
title: Anonymous Cloud Backup with Optional Account-Linking
status: draft
created: 2026-07-20
keywords: [anonymous-auth, supabase, cloud-backup, account-linking, magic-link, reconcile, single-flight, rls, local-first, backup-status]
strategy_grounded: true
---

# Anonymous Cloud Backup with Optional Account-Linking

## Overview & Goals

**Problem.** The web app has no auth UI, so `loadCollectionFromCloud` / `syncCollectionToCloud`
(`packages/core/src/services/supabase.ts:124-125,150-151`) early-return on every call — cloud sync
silently no-ops while a sync indicator is shown. The collection (with its valuable provenance
metadata) therefore lives only in `localStorage`, unprotected, and the fire-and-forget
`catalog_cache` / `set_parts` inserts silently fail for want of an authenticated session.

**Goals.**

1. Turn the dead sync path into a working, trustworthy **backup** with **zero login friction** by
   default (silent anonymous session on boot).
2. Give the user an **optional** path to secure that backup against full-storage-wipe loss (link the
   anonymous session to an email magic-link identity, preserving the same `uid` and data).
3. Make the backup **honest and reliable**: replace the misleading indicator with real backup
   status, and guard `reconcile()` against concurrent runs now that sync is live.

**Non-goals (explicit YAGNI cuts).**

- Multi-device sync as a headline feature. A linked account is the *foundation* for it, but the
  sync-conflict resolution UX is out of scope.
- Retry/backoff on rate-limited Rebrickable calls (tracked separately, ideation #2).
- `localStorage` quota/serialization hardening (tracked separately, ideation #4).
- Full email/password or OAuth login screens.

## Assumptions

- **Runtime:** modern browser with `localStorage`. The Supabase JS client persists its session
  (refresh token) in `localStorage`; session durability across reloads depends on it.
- **Scope of a backup:** anonymous backup is **per-browser-profile** until the user links an email
  identity. A full site-data wipe orphans the anonymous cloud data; linking (Goal 2) is the only
  recovery path against that.
- **Magic-link delivery:** account-linking depends on email deliverability from the Supabase project
  and a configured auth **redirect URL** the app can handle on return.
- **Backend readiness:** `user_collection` RLS already scopes rows by `auth.uid() = user_id`; anon
  users are isolated with no policy change. `@supabase/supabase-js@2.105.1` (installed) supports
  `signInAnonymously()` and `updateUser()`.

## Decisions Made

| #  | Decision | Rationale |
|----|----------|-----------|
| D1 | Anonymous cloud backup via `signInAnonymously()`, not a full login | STRATEGY.md commits to lifecycle consolidation + provenance, **not** multi-device; "stabilize before expanding surface". Zero friction. |
| D2 | Add an **optional** account-link (email magic-link) upgrade | The anon session token lives in `localStorage`; a full wipe orphans cloud data. Linking is the only path that protects the valuable catalog against total loss. |
| D3 | Bundle sync-reliability fixes (single-flight `reconcile` guard + honest error surfacing) | Sync goes *live* here, waking the previously-dormant concurrency race (ideation #3) and the lossy "Sync failed" surfacing. A backup that can interleave or misreport is not stabilized. |
| D4 | Eager anonymous sign-in on app boot | Deterministic session before first sync; also un-breaks the silent `catalog_cache` / `set_parts` insert failures. Anon-user-per-visitor is a non-issue at personal scale. |
| D5 | Auth wrappers (`ensureAnonymousSession`, `linkEmailIdentity`, `getSessionSnapshot`) live in core's `supabase.ts`; web consumes via a hook | Respects the domain/services layer boundary; avoids widening the RR-010 debt. Recorded in `architecture.md` (no standalone ADR). |
| D6 | On anonymous sign-in failure, **fail open to local-only** operation | Local-first-tolerant strategy: the app must never brick because the backend is unreachable, anonymous sign-ins are disabled, or the per-IP rate cap (30/hr) is hit. Surface `backupState='error'`; keep the app fully usable on `localStorage`. |

## Technical Design

### Core auth wrappers — `packages/core/src/services/supabase.ts`

```ts
// Idempotent: returns the current session, creating an anonymous one if none exists.
// Called once from the web bootstrap (D4). Safe to call repeatedly.
// Fails OPEN (D6): on error, returns a typed failure; callers keep working local-only.
export async function ensureAnonymousSession(): Promise<SessionResult>

// Promotes the current anonymous user to an email identity, preserving uid + data (D2).
// Wraps supabase.auth.updateUser({ email }) -> magic link; confirmation links the identity.
export async function linkEmailIdentity(email: string): Promise<LinkResult>

// Thin read for the hook layer to reflect state without importing the client.
export function getSessionSnapshot(): { userId: string | null; isAnonymous: boolean }
```

- `SessionResult = { ok: true; userId: string; isAnonymous: boolean } | { ok: false; reason: 'offline' | 'anon-disabled' | 'rate-limited' | 'unknown' }` — no `any`.
- `LinkResult = { ok: true } | { ok: false; reason: 'email-taken' | 'network' | 'invalid-email' }` — typed so the UI surfaces a specific message.
- `loadCollectionFromCloud` / `syncCollectionToCloud` keep their existing `getUser()` guard **(no signature change)**; with an eager session it now resolves to the anon user, so the early-return (`supabase.ts:124-125,150-151`) stops firing in the normal path — the guard becomes a genuine safety net rather than the default outcome.

### Reconcile reliability — `apps/web/src/services/reconcile.ts`

- **Single-flight guard (D3):** wrap `reconcile()` in a module-level in-flight promise so concurrent
  callers (interval + `online` + manual) await the same run instead of interleaving load/save on the
  shared `localStorage` collection:
  `if (inFlight) return inFlight; inFlight = doReconcile().finally(() => { inFlight = null; });`
- Coalescing note: a mutation made *during* an in-flight run is picked up by the next trigger
  (interval/online/manual) — acceptable, no data loss.

### Bootstrap & hooks — `apps/web/src`

- **`hooks/useAuth.ts` (new):** on mount, `await ensureAnonymousSession()`; expose
  `{ userId, isAnonymous, backupState, linkEmail }` where
  `backupState: 'initializing' | 'backed-up' | 'backing-up' | 'offline' | 'error'`.
- **`hooks/useSync.ts` (edit):** gate the first `runSync` on session readiness (deterministic boot
  order); replace the collapsed `status='error'` (`useSync.ts:11-19`) with a distinguishable error
  carrying a reason, fed from the typed failures above.
- **Account-link return (S4-002):** the app is configured with an auth **redirect URL**; on return
  it detects the session in the URL (`detectSessionInUrl`) to complete linking, then reflects
  `isAnonymous === false`.

### Backup status UI — `apps/web/src/components/SyncStatus.tsx` (filename unchanged, behavior repurposed)

- Report **backup** truthfully: `Backed up` / `Backing up…` / `Offline — will back up when online` /
  `Backup failed — Retry` (with the specific reason). Add a low-key **"Secure my backup"** action
  shown only when `isAnonymous` (opens a small email-entry → magic-link flow calling `linkEmail`).
  Non-nagging: a single unobtrusive affordance, not a modal.

### Config — `supabase/config.toml`

- `enable_anonymous_sign_ins = false` → `true` (line 171). Mirror the toggle on the hosted project
  (documented deploy step, not code).

### Data model

No schema migration. `user_collection` RLS (`auth.uid() = user_id`) already isolates anon users.
Linking preserves `uid`, so existing rows carry over with no data movement.

## Integration Points

**Entry Points**
- New: `useAuth` hook + app-boot bootstrap effect (anonymous session).
- New core exports: `ensureAnonymousSession`, `linkEmailIdentity`, `getSessionSnapshot` from
  `packages/core/src/services/supabase.ts`.
- Changed: `reconcile()` (single-flight), `useSync` (session-gated first run + typed errors),
  `SyncStatus` (behavior → backup status + "Secure my backup").

**Registrations Required**
- Re-export the three new functions through the core public barrel so web imports via the public
  entry, not a deep path.
- Wire `useAuth` into the app bootstrap and pass backup state into `SyncStatus`.

**Documentation Updates**
- `docs/architecture.md` — record auth/session responsibility in core's supabase service, the
  anon-backup + linking model, and decision D5.
- Deploy/README note — the hosted-project `enable_anonymous_sign_ins` toggle and the auth redirect
  URL as required setup.
- `CHANGELOG.md` entry.

**Architectural Decisions (ADR candidates)**
- **D1 (anonymous backup over full auth)** warrants a standalone ADR — a durable product-shaping
  choice (deferring multi-device auth) that future work will repeatedly reference. Points back to
  Decisions Made; not restated here.

**Knowledge Impact**
- New graph concepts: *anonymous-session backup*, *account-linking (uid preservation)*,
  *single-flight reconcile*, *fail-open backup*. Relationships: `SyncStatus` —reflects→ `reconcile`
  —guarded-by→ single-flight; `linkEmailIdentity` —upgrades→ anonymous session.

## Success Criteria

1. **Session bootstraps:** on first load with no stored session, an anonymous session is created —
   `getSessionSnapshot()` returns non-null `userId`, `isAnonymous === true`.
2. **Sync actually persists:** with an anon session, adding/editing an item writes a row to
   `user_collection` scoped to that `auth.uid()`; the early-return in `supabase.ts:124-125,150-151`
   no longer fires in the normal path.
3. **Survives reload:** after a full page reload the same anon session resumes and the collection
   reconciles from cloud with no data change.
4. **Recovers in-app loss:** with the session intact, clearing the local collection then reconciling
   restores it from cloud.
5. **Linking preserves identity:** "Secure my backup" with a valid email sends a magic link; after
   confirmation `isAnonymous === false`, the `uid` is unchanged, and all prior rows remain owned.
6. **Single-flight reconcile:** two concurrent `reconcile()` triggers execute exactly one underlying
   run — asserted by a spy showing one `doReconcile` invocation.
7. **Honest errors:** a backup failure surfaces a distinguishable error state carrying a reason (not
   a blanket "Sync failed"), with a Retry affordance.
8. **Truthful status UI:** `SyncStatus` reflects `backing-up → backed-up`, and shows an offline
   state when `navigator.onLine === false`.
9. **Fail-open on sign-in failure:** when `ensureAnonymousSession()` fails, the app remains fully
   usable local-only and reports `backupState === 'error'` — it does not block or crash.
10. **Config flipped:** `supabase/config.toml` has `enable_anonymous_sign_ins = true`.
11. **Type & regression safety:** no new `any` in the added core functions; `typecheck` passes; all
    existing tests remain green.

## Implementation Order

TDD throughout. Each phase gates the listed success criteria.

- **Phase 1 — Core auth foundation.** Flip config; implement `ensureAnonymousSession` (fail-open,
  D6), `linkEmailIdentity`, `getSessionSnapshot` with unit tests (mocked Supabase auth).
  *Gates SC 1, 9, 10, 11.*
- **Phase 2 — Bootstrap & live sync.** Add `useAuth` + boot effect; gate `useSync`'s first run on
  session readiness; confirm `load`/`syncCollectionToCloud` now persist. *Gates SC 2, 3, 4.*
- **Phase 3 — Reliability.** Single-flight guard on `reconcile()`; typed error surfacing through
  `useSync`. *Gates SC 6, 7.*
- **Phase 4 — Backup status UI + linking flow.** Repurpose `SyncStatus` behavior; add the
  unobtrusive "Secure my backup" email-link flow with redirect-return handling. *Gates SC 5, 8.*
- **Phase 5 — Docs & knowledge.** `architecture.md` (auth-in-core, anon-backup + linking model,
  D5), deploy note for the hosted toggle + redirect URL, `CHANGELOG.md`; graph concepts.
