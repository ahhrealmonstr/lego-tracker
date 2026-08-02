---
feature: provenance-data-model
status: draft
track: Collection & provenance data model
strategy: STRATEGY.md
created: 2026-08-02
keywords: provenance, event-log, storage-locations, content-keyed-identity, schema-migration, condition-axes, offline-sync
---

# Collection & Provenance Data Model

## Overview

Deepen per-set provenance from a handful of incidental fields into the queryable spine
`STRATEGY.md` names as the product's differentiating bet. Today `user_collection` carries
`acquiredQuality`, `savedBox`, `buildStatus`, `displayLocation`, and `quantity` — enough to
describe a set loosely, not enough to answer *when did this change*, *what did I pay*, or
*what is in the garage*.

This spec adds purchase provenance, decomposes condition into independent axes, normalizes
storage locations, and introduces an append-only event log that later initiatives consume.

Provenance is not unshipped — the fields above have existed since the initial schema — but
they arrived incidentally rather than as a deliberate initiative and have never been
deepened.

## Goals

1. Every provenance concept `STRATEGY.md` names is representable **without contradiction**.
   The current enum cannot express "used, has box, no instructions, missing parts" — an
   ordinary bulk-lot purchase.
2. **Metadata depth** becomes computable: a query reports what fraction of owned sets carry
   full provenance.
3. **Backlog throughput** becomes computable *once lifecycle lands* — the event log records
   transitions with timestamps, so the metric needs no further schema work.
4. Existing collections migrate with **zero silent data loss**, retaining a rollback copy.
5. Locations are reusable and renameable in one place, converging across offline devices
   without user intervention.

## Non-goals

Things this spec has decided **not** to do. Work that is merely *not yet* scheduled lives in
Fast-follows below — the distinction matters, because a non-goal is a decision and a
fast-follow is a queue position.

- **Box stored separately from the set** — `boxLocation` deliberately omitted. A collector
  who keeps boxes in the attic and sets on a shelf cannot express that. Accepted until the
  need is demonstrated rather than imagined.
- **Converting `estimated_value` to minor units** — see D9. Leaves two money representations
  in one table, accepted knowingly; unrelated to these goals and would widen the migration.
- **A general-purpose audit log** — `collection_events` records provenance and location
  changes only. It is not a change-data-capture stream for the whole collection, and should
  not grow into one without a separate decision.

### Deferred, not rejected

These have entry criteria and appear in Fast-follows. Listed here only because a reader
scanning for scope will look in this section:

- **Trending value** — needs an external price-history feed (integration, not data model).
- **Lifecycle state expansion** — `owned → building → completed → displayed` belongs to the
  Build Lifecycle & Backlog initiative, this event log's first consumer.
- **Full event-sourced reads** — deferred per D2, which carries an explicit trigger.
- **Session build-progress** — depends on lifecycle.

## Terms used below

Referenced repeatedly as rationale, so defined once rather than assumed:

- **S1** — a data-loss race found in review of the cloud-backup work (PR #12): mutations
  enqueued *during* an in-flight sync were dropped by `clearSyncQueue`, which matched entries
  positionally. Fixed by content-keyed `removeSyncedEntries` (commit `b3f09eb`). It is the
  precedent for D1 and D7 — both are the same "identity by position/timing is unstable"
  failure in different clothing.
- **M7** — the Anonymous Cloud Backup milestone (PR #12 and follow-ups #13, #15), which built
  the sync/reconcile layer this spec is unwilling to rewrite.
- **LWW** — last-write-wins, the reconciliation rule in `domain/sync.ts`: for a given item,
  the copy with the greater `updatedAt` survives, with ties awarded to remote.

## Decisions made

| # | Decision | Rationale |
| --- | --- | --- |
| **D1** | Hybrid model — `user_collection` remains the current-state read model, with an append-only `collection_events` table alongside | Full event sourcing would rewrite the sync/reconcile layer hardened in M7, which already caught one data-loss race (S1). Three of five `STRATEGY.md` metrics are time-series questions that flat columns cannot answer. |
| **D2** | Full event-sourced reconciliation deferred until the app is stable | Append-only events accumulate correctly from day one, so folding them later loses nothing. Trigger condition below. |
| **D3** | Scope limited to provenance + event foundation — which fixes the event catalogue at exactly three types, and puts lifecycle and trending value in Fast-follows with entry criteria rather than a fixed order | Keeps Build Lifecycle a separately-plannable initiative and an external price feed off the critical path. Sequencing of the follow-ons is deliberately not frozen here; entry criteria matter more than order. |
| **D5** | Decompose `acquiredQuality` into `condition` + `hasBox` + `hasInstructions` + `partsComplete` | The enum conflates four orthogonal axes. `acquiredQuality` and `savedBox` are independently editable (`DetailPanel.tsx:90,130`), so contradictory states are reachable today. Pre-1.0 is the cheap moment to fix it. |
| **D6** | Normalized `storage_locations` table with FK | Chosen over structured columns despite introducing a second synced entity — accepted knowingly in exchange for rename-once semantics. |
| **D7** | Content-keyed location identity: `unique (user_id, normalized_name)`, plus an explicit rename that repoints FKs | Two offline devices creating "Bin 3" must converge to one row. Mirrors the S1 fix, which replaced positional matching with content-keyed matching. |
| **D8** | Versioned storage key + eager migration, retaining `v1` | `loadCollection()` silently `.filter()`s invalid records (`storage.ts`, `parsed.filter(isOwnedLegoItem)`), so a naive type change would delete collections with no error. |
| **D9** | `purchase_price_minor` stored as an integer in minor units | Avoids float drift on money. Leaves two money representations in the table, since `estimated_value` stays `NUMERIC` — accepted and recorded rather than hidden. The unit is in the column name so a cents-read-as-dollars mistake is hard to write. |

### D2 trigger condition

Revisit full event-sourced reads when **all** of the following hold:

- cloud-backup is live in production (issue #14) and has completed one clean multi-device
  verification cycle;
- the Build Lifecycle initiative has shipped and is writing events;
- `collection_events` has demonstrated correct convergence across offline devices for at
  least one release.

### Fast-follows (per D3)

| Fast-follow | Entry criteria | Notes |
| --- | --- | --- |
| Build lifecycle states | This spec merged; event log accepting writes | First consumer of `collection_events`; unlocks backlog throughput |
| Trending value | Lifecycle shipped; price source chosen with ToS and rate-limit review | Writes `value_snapshot` events; no schema change needed |
| Normalized location hierarchy | Rename-once proves insufficient (nested areas wanted) | `location.area` becomes an FK; migration is additive |
| `estimated_value` → minor units | Any change already touching catalog value | Removes the two-representation inconsistency from D9 |

## Technical design

### Condition axes (D5)

`acquiredQuality` and `savedBox` are not redundant — they describe **different points in
time**. `acquiredQuality` is condition *at acquisition*; `savedBox` is whether the box is
still held *now*. The hybrid model separates them rather than forcing a merge:

- **Acquisition condition** — an immutable fact, recorded in an `acquired` event.
- **Current provenance** — mutable state on `user_collection`.

```ts
export type ItemCondition = 'sealed' | 'new-opened' | 'used';

export interface ProvenanceState {
  condition: ItemCondition;
  hasBox: boolean | null;          // null = unknown, distinct from false
  hasInstructions: boolean | null;
  partsComplete: boolean | null;
}
```

`sealed` collapses what would otherwise be a fifth boolean, and is the distinction that most
affects resale value. A `sealed` item implies the other three are true — enforced by a CHECK
constraint, not by convention.

`null` means *unknown*, deliberately distinct from `false`. A migrated `used-no-box` record
genuinely does not know whether instructions were present; recording that as "no
instructions" would fabricate data.

**Relationship to `missingPartsList`:** kept separate, not derived. `partsComplete === null`
means "not checked"; an empty `missingPartsList` means the same thing. Deriving one from the
other would conflate "verified complete" with "never audited" — precisely what the
missing-parts capture-accuracy metric measures.

### Purchase provenance (D9)

```ts
export interface PurchaseInfo {
  priceMinor: number | null;     // integer minor units
  currency: string | null;       // ISO 4217; null means "amount recorded, currency unknown"
  purchasedAt: string | null;    // LOCAL calendar date, YYYY-MM-DD — see below
  source: string | null;         // free text
}
```

**`purchasedAt` is a local calendar date, not an instant.** It answers "what day did I buy
this," which is a fact about the buyer's calendar, not a point on the UTC timeline. It must
**not** be derived as `new Date().toISOString().slice(0, 10)`: a user in UTC-5 recording an
8pm purchase would get *tomorrow's* date, permanently wrong in a user-visible field. Derive
it from local date parts, and store no time component — a date with no time cannot be
silently re-interpreted in another zone.

This is deliberately the opposite convention from `addedAt`, `updatedAt`, and event `at`,
which are instants and are correctly UTC. The two kinds of temporal value are not
interchangeable and should not share a helper.

**A null `currency` with a non-null `priceMinor` is valid** and means the amount is known but
the currency was not recorded — common for older acquisitions. Display falls back to the
user's locale currency with no unit conversion, since converting an amount whose currency is
unknown would fabricate precision. Success Criterion 11 deliberately excludes `currency` from
the metadata-depth bar for this reason.

`source` is free text rather than an enum: bulk-lot collectors buy from places no enum
anticipates, and a wrong enum is worse than a string.

`purchasedAt` is deliberately distinct from `addedAt`. Sets are catalogued long after they
are bought, and conflating the two corrupts any value-over-time analysis.

### Storage locations (D6, D7)

```sql
CREATE TABLE public.storage_locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  name            TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT GENERATED ALWAYS AS (lower(trim(name))) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, normalized_name)
);
```

The generated column makes content-keying a database guarantee rather than application
discipline: two offline devices inserting `"Bin 3"` and `"bin 3 "` converge on one row via
upsert, with no coordination.

`user_collection.location_id UUID REFERENCES storage_locations(id) ON DELETE SET NULL` —
deleting a location orphans items to "unfiled" rather than cascading away collection data.

**Rename** repoints rather than mutates: insert-or-select the new name, update referencing
items, delete the old row if unreferenced — in one transaction. A naive `UPDATE name` would
break identity for any device that has not yet synced.

### Event log (D1, D3)

```ts
export type CollectionEventType =
  | 'acquired'
  | 'provenance_changed'
  | 'location_changed';

export interface CollectionEvent {
  id: string;
  itemId: string;
  type: CollectionEventType;
  at: string;
  payload: Record<string, unknown>;
}
```

Append-only, enforced by RLS: `INSERT` and `SELECT` policies only, no `UPDATE` or `DELETE`.
A unique constraint on `(item_id, type, at, md5(payload::text))` makes replay idempotent, so
a device re-pushing its queue cannot duplicate history.

**`at` must come from `nowIso()`, never `new Date().toISOString()`.** This is load-bearing,
not stylistic. `Date.now()` has millisecond resolution and was measured colliding on
1999/2000 back-to-back calls. On an append-only table with no `UPDATE` policy, two genuinely
distinct same-type events for one item in the same millisecond do not merge — the second is
rejected. The constraint exists to make *replay* idempotent; at raw millisecond resolution it
would also silently swallow *real* rapid events, which is the opposite of what an audit log
is for. `domain/clock.ts` guarantees strictly increasing stamps within a process precisely so
this constraint discriminates replays from distinct events.

Cross-device collisions on `at` remain possible and are *correct* to reject: two devices
emitting the same event type for the same item with an identical payload at the same
millisecond are, for this log's purposes, the same fact.

### Migration (D8)

The storage key bumps to `brick-ledger.collection.v2`. `v1` is retained untouched.

| v1 `acquiredQuality` | → `acquired` event condition | `hasBox` (current) |
| --- | --- | --- |
| `new` | `sealed` | from `savedBox` |
| `new-open-box` | `new-opened` | from `savedBox` |
| `used-with-box-instructions` | `used` (+box, +instructions) | from `savedBox` |
| `used-no-box` | `used` (−box) | from `savedBox` |
| `used-no-instructions` | `used` (−instructions) | from `savedBox` |
| `used-missing-parts` | `used` (−complete) | from `savedBox` |

Current `hasBox` always takes `savedBox` — the more recently edited truth — while the
historical claim lives in the event. The D5 contradiction dissolves rather than being
arbitrated.

Locations migrate by extracting distinct non-empty `displayLocation` values into
`storage_locations` and repointing items. A synthetic `acquired` event is seeded per item
from `addedAt`.

**Retention of `v1`.** Dropped at whichever comes first:

- **A confirmed cloud round-trip** — defined as: a v2 push succeeds *and* a subsequent read
  returns a row whose `updated_at` is at least the pushed value. A push acknowledgement
  alone is insufficient; the read-back is what proves the data is recoverable from the
  cloud, which is the only reason `v1` is being kept.
- **30 days measured from the migration timestamp**, recorded as
  `brick-ledger.migratedAt.v2` when the transform runs — not from install, not from last
  access. An offline-only user reaches this bound without ever satisfying the first.

Both conditions are checked on load. Neither deletes `v1` while a migration is in progress.

**Sync guard:** the sync payload carries `schemaVersion`. A device still on v1 must not have
its rows interpreted as v2, so push is gated on migration completion and the reconcile path
rejects mismatched versions rather than coercing them.

## Integration Points

### Entry Points

- `packages/core/src/types/lego.ts` — `ProvenanceState`, `PurchaseInfo`, `StorageLocation`,
  `CollectionEvent`; `OwnedLegoItem` reshaped
- `packages/core/src/domain/provenance.ts` *(new)* — axis logic, sealed-implies-complete
  invariant
- `packages/core/src/domain/migration.ts` *(new)* — v1→v2 transform, independently testable
- `packages/core/src/services/supabase.ts` — row mapping for two new tables
- `apps/web/src/services/storage.ts` — versioned load, retained `v1`
- `apps/web/src/components/DetailPanel.tsx` — four axis inputs replacing one dropdown and
  one checkbox
- One SQL migration under `supabase/migrations/`

### Registrations Required

- Barrel export in `packages/core/src/index.ts` for the new types and both new modules
- RLS policies on `storage_locations` (full CRUD, user-scoped) and `collection_events`
  (INSERT/SELECT only)
- `SyncQueueEntry` union extended for location upserts

### Documentation Updates

- `docs/architecture.md` — the two new tables and the hybrid read/event split
- `AGENTS.md` — provenance axes as domain vocabulary
- `docs/user-guide.md` — condition axes replacing the single dropdown
- `CHANGELOG.md` — breaking change to the collection CSV export shape

### Architectural Decisions

- **D1** warrants ADR `0002`. Choosing hybrid over full event sourcing is a long-lived
  constraint that anyone later wanting full replay will question; the reasoning must outlive
  this spec.
- **D7** warrants ADR `0003`. Content-keyed identity looks arbitrary until someone hits the
  duplicate-"Bin 3" case; the S1 precedent belongs in the record.
- D5, D6, D8, D9 stay in this spec — consequential, but self-evident from the schema.

### Knowledge Impact

- New concepts: *provenance axis*, *acquisition-vs-current state*, *content-keyed identity*
- New relationship: `collection_events` as a shared substrate the Build Lifecycle initiative
  consumes
- Supersedes the documented `AcquisitionQuality` enum in `docs/knowledge/`

## Success Criteria

1. A set can be recorded as used, with box, without instructions, and missing parts —
   impossible today.
2. `sealed` combined with any of `hasBox`, `hasInstructions`, or `partsComplete` set to false
   is rejected by a CHECK constraint, not by convention.
3. Unknown provenance reads as `null` and is never coerced to `false`.
4. Given a v1 fixture collection, migration produces the expected v2 collection with **zero
   dropped items**, asserted against fixtures including malformed records.
   **This requires an API change to be observable at all:** `loadCollection()` currently
   returns `OwnedLegoItem[]` and discards invalid records silently
   (`storage.ts` — `parsed.filter(isOwnedLegoItem)`), so "zero dropped" cannot be asserted
   from the call site. The migration must either read the raw JSON and diff lengths itself,
   or `loadCollection` must return `{ items, dropped }`. Decide this in Implementation Order
   step 2, before anything writes v2 — a criterion that cannot be measured is not a criterion.
5. After migration, `v1` remains readable in localStorage.
6. Two devices offline, both creating "Bin 3", converge to exactly one `storage_locations`
   row on sync.
7. Renaming a location updates every referencing item and leaves no orphan row.
8. Deleting a location sets referencing items to unfiled; no collection item is deleted.
9. Re-pushing an already-synced event queue creates no duplicate rows.
10. A v1 device's payload is rejected by reconcile rather than coerced.
11. Metadata depth is answerable in SQL. **Definition, so two readers compute the same
    number:** an owned set counts as *fully provenanced* when all four condition axes are
    non-null, `location_id` is non-null, and **at least `purchase_price_minor` and
    `purchased_at`** are non-null. `currency` and `source` are excluded — a price with no
    recorded currency still carries the information the metric is about, and `source` is
    frequently unknowable for older acquisitions. The metric is the percentage of
    `status = 'collection'` rows meeting that bar.

## Implementation Order

1. **Types and domain logic** — axes and invariants, no persistence. Pure and fully testable.
2. **Migration transform** — v1→v2 against fixtures, before anything can write v2.
3. **Schema and RLS** — two tables, new columns, constraints.
4. **Storage layer** — versioned load, retained `v1`, expiry.
5. **Sync** — location upserts, event append, `schemaVersion` gate.
6. **UI** — axis inputs, location picker, purchase fields.
7. **Docs and ADRs.**

The order is deliberate: the migration is testable at step 2, *before* any code can write the
new shape, so a transform bug is caught while its blast radius is still zero.
