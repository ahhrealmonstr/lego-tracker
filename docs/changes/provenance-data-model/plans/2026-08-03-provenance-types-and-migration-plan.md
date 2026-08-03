# Plan: Provenance Types and Migration Transform

**Date:** 2026-08-03 | **Spec:** `docs/changes/provenance-data-model/proposal.md` (Implementation Order steps 1–2) | **Tasks:** 11 | **Time:** ~47 min | **Integration Tier:** medium

## Goal

`migrateV1ToV2()` turns a raw v1 collection into v2 provenance shapes and reports every record it could not convert — proven against fixtures including malformed records, with no persistence layer involved.

## Scope boundary

This plan covers **spec steps 1–2 only**. Steps 3–7 (SQL schema and RLS, storage layer, sync, UI, docs and ADRs) get their own plans.

The spec's ordering is deliberate and this plan preserves it: the migration is fully testable *before* any code can write the new shape, so a transform bug is caught while its blast radius is zero.

### Expand/contract: `OwnedLegoItem` is NOT reshaped in this plan

The spec's Entry Points say "`OwnedLegoItem` reshaped". Doing that in step 1 would break `App.tsx`, `DetailPanel.tsx`, `supabase.ts`, `export.ts`, and `import.ts` simultaneously, leaving the build red across a slice that is supposed to be pure and shippable.

Instead this plan **adds `OwnedLegoItemV2` alongside the untouched `OwnedLegoItem`**. The migration maps v1 → v2. Steps 4–6 move the app onto v2 incrementally, and the old name is retired only once nothing reads it.

Consequence: for the duration of steps 1–3 both types exist. That is intended, not drift.

### `loadCollection` keeps its signature in this plan

SC4 requires "zero dropped items" to be observable. Decided (2026-08-03): `migrateV1ToV2()` returns `{ items, dropped }`, which makes SC4 measurable **in core, against fixtures**, with no persistence involved.

`loadCollection()` adopts the same shape at **step 4** (storage layer), where it belongs — it drags `App.tsx:58` and `reconcile.ts:33` with it. `reconcile.ts` merges local against cloud, so "dropped" means something different there and needs its own definition rather than inheriting this one.

## Observable truths

Written EARS-style where behavioural.

1. When `migrateV1ToV2` receives a v1 array containing `n` valid records, the system shall return exactly `n` items and an empty `dropped` array. *(SC4)*
2. When `migrateV1ToV2` receives a record failing v1 validation, the system shall include it in `dropped` with its index and a reason, and shall not include it in `items`. *(SC4)*
3. `items.length + dropped.length` shall equal the input array length, for every input. *(SC4 — the accounting identity)*
4. If a `ProvenanceState` has `condition: 'sealed'` with any of `hasBox`, `hasInstructions`, `partsComplete` not `true`, then `isProvenanceValid` shall return `false`. *(SC2, domain half)*
5. Where a v1 record's provenance is not knowable from `acquiredQuality`, the system shall record `null` and shall not coerce to `false`. *(SC3)*
6. When `migrateV1ToV2` converts a record, the system shall emit exactly one synthetic `acquired` event whose `at` equals the record's `addedAt`.
7. When two v1 records carry `displayLocation` values differing only by case or surrounding whitespace, the system shall produce exactly one `StorageLocation`. *(SC6, domain half)*
8. The system shall never derive `purchasedAt` from `toISOString()`.

## Uncertainties

- **[RESOLVED — see below]** Migrated *current* condition when `acquiredQuality: 'new'` meets `savedBox: false`.
- **[ASSUMPTION]** v1 records reaching the migration have already passed `isOwnedLegoItem`-equivalent validation OR are malformed; there is no third category. If a partially-valid category emerges, Task 9's `dropped` reasons need extending.
- **[DEFERRABLE]** `StorageLocation.id` generation. This plan uses a deterministic id derived from the normalized name so fixtures are stable; the real UUID arrives with the SQL schema at step 3.

### Resolved: sealed-vs-savedBox contradiction

The spec's migration table maps `acquiredQuality: 'new'` → condition `sealed`, and separately says current `hasBox` "always takes `savedBox`". Those two rules collide: a `new` item with `savedBox: false` would migrate to `sealed` + `hasBox: false`, which SC2 requires be *rejected*.

The collision is only apparent, and dissolves the way the spec's own Condition Axes section indicates — acquisition and current state are different points in time:

- The **`acquired` event** records the acquisition claim: `sealed`. Immutable, historical, and never re-validated against today's box.
- The **current `ProvenanceState`** must satisfy the invariant. An item whose box is gone is not sealed today, so current condition degrades `sealed` → `new-opened` when `savedBox` is `false`.

Encoded in Task 6 inside `provenanceFromV1()`, asserted directly by its "degrades new to new-opened when the box is gone" case, and recorded here because it is a judgement call an implementer would otherwise make silently and inconsistently.

## File map

```text
CREATE packages/core/src/domain/provenance.ts
CREATE packages/core/src/domain/provenance.test.ts
CREATE packages/core/src/domain/migration.ts
CREATE packages/core/src/domain/migration.test.ts
MODIFY packages/core/src/types/lego.ts        (add v2 types; OwnedLegoItem untouched)
MODIFY packages/core/src/index.ts             (barrel exports)
MODIFY packages/core/src/index.test.ts        (public-surface assertions)
```

No file under `apps/web/` is touched by this plan.

## Tasks

### Task 1: Add the provenance axis types

**Depends on:** none | **Files:** `packages/core/src/types/lego.ts`

Append to `types/lego.ts`. Do not modify `OwnedLegoItem`.

```ts
export type ItemCondition = 'sealed' | 'new-opened' | 'used';

/**
 * Current provenance. `null` means UNKNOWN and is deliberately distinct from
 * `false` — a migrated `used-no-box` record genuinely does not know whether
 * instructions were present, and recording that as "no instructions" would
 * fabricate data.
 */
export interface ProvenanceState {
  condition: ItemCondition;
  hasBox: boolean | null;
  hasInstructions: boolean | null;
  partsComplete: boolean | null;
}
```

**Verified by:** `npm run typecheck`. Types produce no runtime behaviour, so typecheck is the gate; Task 2 exercises them behaviourally.
**Commit:** `feat(core): add ItemCondition and ProvenanceState types`

---

### Task 2: `isProvenanceValid` — the sealed-implies-complete invariant

**Depends on:** Task 1 | **Files:** `packages/core/src/domain/provenance.ts`, `packages/core/src/domain/provenance.test.ts`

TDD. Write `provenance.test.ts` first:

```ts
import { describe, it, expect } from 'vitest';
import { isProvenanceValid } from './provenance';
import type { ProvenanceState } from '../types/lego';

const used: ProvenanceState = {
  condition: 'used', hasBox: null, hasInstructions: null, partsComplete: null,
};

describe('isProvenanceValid', () => {
  it('accepts sealed when all three axes are true', () => {
    expect(isProvenanceValid({
      condition: 'sealed', hasBox: true, hasInstructions: true, partsComplete: true,
    })).toBe(true);
  });

  it.each(['hasBox', 'hasInstructions', 'partsComplete'] as const)(
    'rejects sealed when %s is false', (axis) => {
      expect(isProvenanceValid({
        condition: 'sealed', hasBox: true, hasInstructions: true, partsComplete: true,
        [axis]: false,
      })).toBe(false);
    },
  );

  // `null` is unknown, and an unknown axis cannot support a `sealed` claim.
  it.each(['hasBox', 'hasInstructions', 'partsComplete'] as const)(
    'rejects sealed when %s is unknown', (axis) => {
      expect(isProvenanceValid({
        condition: 'sealed', hasBox: true, hasInstructions: true, partsComplete: true,
        [axis]: null,
      })).toBe(false);
    },
  );

  it('imposes no axis constraint on non-sealed conditions', () => {
    expect(isProvenanceValid(used)).toBe(true);
    expect(isProvenanceValid({ ...used, condition: 'new-opened', hasBox: false })).toBe(true);
  });
});
```

Run `npx vitest run packages/core/src/domain/provenance.test.ts` — expect RED. Then implement:

```ts
import type { ProvenanceState } from '../types/lego';

/**
 * `sealed` collapses what would otherwise be a fourth boolean, so it carries an
 * implication: a sealed box has its box, its instructions, and all its parts.
 * `null` (unknown) does not satisfy the implication — an unverified axis cannot
 * back a sealed claim. Mirrored by a CHECK constraint at step 3; this is the
 * domain half, so the rule holds before the row ever reaches Postgres.
 */
export function isProvenanceValid(state: ProvenanceState): boolean {
  if (state.condition !== 'sealed') {
    return true;
  }
  return state.hasBox === true && state.hasInstructions === true && state.partsComplete === true;
}
```

Expect GREEN.
**Commit:** `feat(core): add sealed-implies-complete provenance invariant`

---

### Task 3: Add `PurchaseInfo` with the local-date contract

**Depends on:** Task 1 | **Files:** `packages/core/src/types/lego.ts`

```ts
/**
 * `purchasedAt` is a LOCAL CALENDAR DATE (YYYY-MM-DD), not an instant. It
 * answers "what day did I buy this" — a fact about the buyer's calendar, not a
 * point on the UTC timeline.
 *
 * It must NEVER be derived via `new Date().toISOString().slice(0, 10)`: a user
 * in UTC-5 recording an 8pm purchase would get TOMORROW'S date, permanently
 * wrong in a user-visible field.
 *
 * This is deliberately the opposite convention from `addedAt`, `updatedAt`, and
 * event `at`, which are instants and correctly UTC. The two kinds of temporal
 * value are not interchangeable and must not share a helper — notably NOT
 * `nowIso()`.
 *
 * A null `currency` with a non-null `priceMinor` is VALID: the amount is known
 * but the currency was not recorded, common for older acquisitions.
 */
export interface PurchaseInfo {
  priceMinor: number | null;
  currency: string | null;
  purchasedAt: string | null;
  source: string | null;
}
```

**Verified by:** `npm run typecheck`. Types produce no runtime behaviour, so typecheck is the gate.
**Commit:** `feat(core): add PurchaseInfo type with local-date contract`

---

### Task 4: `todayLocalDate()` — the local-date helper

**Depends on:** Tasks 2, 3 | **Files:** `packages/core/src/domain/provenance.ts`, `packages/core/src/domain/provenance.test.ts`

The spec forbids a UTC derivation but the codebase has no local-date helper, so anyone needing one will reach for `toISOString()`. Give them the correct tool in the same module.

Test first — the assertion must prove the timezone property, not merely the format:

```ts
describe('todayLocalDate', () => {
  it('returns the LOCAL calendar date, not the UTC one', () => {
    // 2026-03-01T02:30:00Z is still 2026-02-28 in UTC-5. A toISOString-based
    // implementation returns '2026-03-01' here and fails.
    const instant = new Date('2026-03-01T02:30:00.000Z');
    const local = todayLocalDate(instant);
    const expected = `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, '0')}-${String(instant.getDate()).padStart(2, '0')}`;
    expect(local).toBe(expected);
  });

  it('zero-pads single-digit months and days', () => {
    expect(todayLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('carries no time component', () => {
    expect(todayLocalDate(new Date(2026, 6, 4))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

Implement:

```ts
/**
 * Local calendar date as YYYY-MM-DD. Uses local date PARTS deliberately —
 * `toISOString().slice(0, 10)` would hand a UTC-5 user tomorrow's date for an
 * 8pm purchase. Do NOT route this through `nowIso()`: that returns an instant,
 * which is the opposite kind of value.
 */
export function todayLocalDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

**Verify:** `npx vitest run packages/core/src/domain/provenance.test.ts`
**Commit:** `feat(core): add todayLocalDate helper for purchase dates`

---

### Task 5: Add `StorageLocation`, `CollectionEvent`, and `OwnedLegoItemV2`

**Depends on:** Tasks 1, 3 | **Files:** `packages/core/src/types/lego.ts`

```ts
export interface StorageLocation {
  id: string;
  name: string;
}

export type CollectionEventType = 'acquired' | 'provenance_changed' | 'location_changed';

/**
 * Append-only. `at` MUST come from `nowIso()`, never `new Date().toISOString()`
 * — see `domain/clock.ts`. The unique constraint added at step 3 covers
 * `(item_id, type, at, md5(payload))` and REJECTS rather than merges, so at raw
 * millisecond resolution it would silently swallow genuinely distinct rapid
 * events. `nowIso()` guarantees strictly increasing stamps within a process
 * precisely so that constraint discriminates replays from distinct facts.
 */
export interface CollectionEvent {
  id: string;
  itemId: string;
  type: CollectionEventType;
  at: string;
  payload: Record<string, unknown>;
}

/**
 * The v2 collection item. Added ALONGSIDE `OwnedLegoItem` rather than replacing
 * it: reshaping in place would break App, DetailPanel, supabase, export and
 * import at once. Steps 4-6 migrate consumers; the old type retires when
 * nothing reads it.
 */
export interface OwnedLegoItemV2 extends LegoCatalogItem {
  status: CollectionStatus;
  provenance: ProvenanceState;
  purchase: PurchaseInfo;
  locationId: string | null;
  buildStatus: BuildStatus;
  notes: string;
  missingParts: string;
  missingPartsList?: MissingSetPart[];
  quantity: number;
  addedAt: string;
  updatedAt: string;
}
```

**Verified by:** `npm run typecheck`. Types produce no runtime behaviour, so typecheck is the gate.
**Commit:** `feat(core): add StorageLocation, CollectionEvent, OwnedLegoItemV2`

---

### Task 6: `provenanceFromV1` — the acquisition-quality mapping

**Depends on:** Tasks 2, 5 | **Files:** `packages/core/src/domain/migration.ts`, `packages/core/src/domain/migration.test.ts`

Implements the spec's migration table plus the resolved sealed-vs-savedBox rule.

Test first, one case per v1 quality, plus the collision case:

```ts
describe('provenanceFromV1', () => {
  it('maps new + savedBox to sealed with all axes true', () => {
    expect(provenanceFromV1('new', true)).toEqual({
      condition: 'sealed', hasBox: true, hasInstructions: true, partsComplete: true,
    });
  });

  // The resolved collision: sealed cannot survive a missing box.
  it('degrades new to new-opened when the box is gone', () => {
    const result = provenanceFromV1('new', false);
    expect(result.condition).toBe('new-opened');
    expect(result.hasBox).toBe(false);
    expect(isProvenanceValid(result)).toBe(true);
  });

  it('leaves unstated axes unknown rather than false', () => {
    expect(provenanceFromV1('used-no-box', true).hasInstructions).toBeNull();
    expect(provenanceFromV1('used-no-box', true).partsComplete).toBeNull();
  });

  it('records the axis each used-variant actually asserts', () => {
    expect(provenanceFromV1('used-no-instructions', true).hasInstructions).toBe(false);
    expect(provenanceFromV1('used-missing-parts', true).partsComplete).toBe(false);
    expect(provenanceFromV1('used-with-box-instructions', true).hasInstructions).toBe(true);
  });

  it('treats an absent acquiredQuality as fully unknown used', () => {
    const result = provenanceFromV1(undefined, true);
    expect(result.condition).toBe('used');
    expect(result.hasInstructions).toBeNull();
  });

  it('never produces a state failing the invariant, for any input', () => {
    const qualities = [undefined, 'new', 'new-open-box', 'used-with-box-instructions',
      'used-no-box', 'used-no-instructions', 'used-missing-parts'] as const;
    for (const q of qualities) {
      for (const savedBox of [true, false]) {
        expect(isProvenanceValid(provenanceFromV1(q, savedBox))).toBe(true);
      }
    }
  });
});
```

The last case is the important one: it makes the invariant a property over the whole input space rather than a spot check.

`acquiredQuality` is `AcquisitionQuality | undefined` — Task 5 of PR #31 established that wishlist items carry none.

**Verify:** `npx vitest run packages/core/src/domain/migration.test.ts`
**Commit:** `feat(core): map v1 acquisition quality to v2 provenance axes`

---

### Task 7: Location extraction with content-keyed identity

**Depends on:** Task 6 | **Files:** `packages/core/src/domain/migration.ts`, `packages/core/src/domain/migration.test.ts`

Delivers observable truth 7 (SC6, domain half). Signature:

```ts
export function extractLocations(names: readonly string[]): {
  locations: StorageLocation[];
  /** Maps any source spelling to the id of the location it converged onto. */
  idFor: (name: string) => string | null;
};
```

Tests:

```ts
describe('extractLocations', () => {
  it('converges names differing only by case or whitespace', () => {
    const { locations } = extractLocations(['Bin 3', 'bin 3 ', ' BIN 3']);
    expect(locations).toHaveLength(1);
  });

  it('maps each source name to the surviving location id', () => {
    const { locations, idFor } = extractLocations(['Bin 3', 'bin 3 ']);
    expect(idFor('Bin 3')).toBe(locations[0].id);
    expect(idFor('bin 3 ')).toBe(locations[0].id);
  });

  it('keeps the first-seen spelling as the display name', () => {
    expect(extractLocations(['Bin 3', 'BIN 3']).locations[0].name).toBe('Bin 3');
  });

  it('ignores empty and whitespace-only locations', () => {
    expect(extractLocations(['', '   ', 'Shelf']).locations).toHaveLength(1);
  });
});
```

Normalization must match the SQL generated column exactly — `lower(trim(name))` — or the database and the domain will disagree about identity. State that in a comment referencing `storage_locations.normalized_name`.

**Verify:** `npx vitest run packages/core/src/domain/migration.test.ts`
**Commit:** `feat(core): extract storage locations with content-keyed identity`

---

### Task 8: Synthetic `acquired` event seeding

**Depends on:** Tasks 5, 6, 7 | **Files:** `packages/core/src/domain/migration.ts`, `packages/core/src/domain/migration.test.ts`

Delivers observable truth 6. Signature:

```ts
/** `raw` is a v1 record already known valid — Task 9 screens malformed input. */
export function acquiredEventFor(raw: OwnedLegoItem): CollectionEvent;
```

Tests:

```ts
describe('acquiredEventFor', () => {
  it('stamps the event at the item addedAt, not now', () => {
    const event = acquiredEventFor(v1Item({ addedAt: '2024-01-01T00:00:00.000Z' }));
    expect(event.at).toBe('2024-01-01T00:00:00.000Z');
  });

  it('records the ACQUISITION condition, which may differ from current', () => {
    // new + box gone: current degrades to new-opened, history stays sealed.
    const event = acquiredEventFor(v1Item({ acquiredQuality: 'new', savedBox: false }));
    expect(event.payload.condition).toBe('sealed');
  });

});
```

"Exactly one event per surviving item" is asserted in Task 9, where the whole
transform is in scope. Do **not** leave a placeholder test for it here — an
empty test body passes vacuously, which is the failure mode this suite has
already been bitten by twice.

The second case is the point of the whole acquisition-vs-current split, so it is asserted directly rather than implied.

`at` comes from the record's own `addedAt` — a historical fact, so **not** `nowIso()`. `nowIso()` governs events generated *now*; this one is backdated by definition.

**Verify:** `npx vitest run packages/core/src/domain/migration.test.ts`
**Commit:** `feat(core): seed a synthetic acquired event per migrated item`

---

### Task 9: `migrateV1ToV2` with drop accounting

**Depends on:** Tasks 6, 7, 8 | **Files:** `packages/core/src/domain/migration.ts`, `packages/core/src/domain/migration.test.ts`

The SC4 task. Signature:

```ts
export interface DroppedRecord {
  index: number;
  reason: 'not-an-object' | 'missing-required-field' | 'invalid-field-type';
  raw: unknown;
}

export interface MigrationResult {
  items: OwnedLegoItemV2[];
  locations: StorageLocation[];
  events: CollectionEvent[];
  dropped: DroppedRecord[];
}

export function migrateV1ToV2(raw: unknown): MigrationResult;
```

`raw` is `unknown`, not `OwnedLegoItem[]` — the input is parsed JSON from localStorage and has no type guarantee. Accepting a typed array would make the malformed-record tests unwritable, which is exactly how SC4 became unobservable in the first place.

Tests must include the accounting identity as a property:

```ts
it('accounts for every input record, valid or not', () => {
  const input = [validV1(), null, validV1(), { id: 'x' }, 'nonsense', validV1()];
  const result = migrateV1ToV2(input);
  expect(result.items.length + result.dropped.length).toBe(input.length);
});

it('drops zero items for an all-valid fixture', () => {
  const result = migrateV1ToV2([validV1(), validV1(), validV1()]);
  expect(result.dropped).toEqual([]);
  expect(result.items).toHaveLength(3);
});

it('reports the index of each dropped record so it can be found in the source', () => {
  const result = migrateV1ToV2([validV1(), null, validV1()]);
  expect(result.dropped[0].index).toBe(1);
});

it('returns an empty result rather than throwing when input is not an array', () => {
  expect(migrateV1ToV2({ not: 'an array' })).toEqual({
    items: [], locations: [], events: [], dropped: [],
  });
});

it('emits exactly one acquired event per surviving item', () => {
  const result = migrateV1ToV2([validV1(), null, validV1()]);
  expect(result.events.filter((e) => e.type === 'acquired')).toHaveLength(2);
});
```

**Verify:** `npx vitest run packages/core/src/domain/migration.test.ts`
**Commit:** `feat(core): add migrateV1ToV2 transform with drop accounting`

---

### Task 10: Fixture-based migration test against a realistic v1 collection

**Depends on:** Task 9 | **Files:** `packages/core/src/domain/migration.test.ts`

SC4 says "asserted against fixtures including malformed records". Tasks 6–9 test units; this asserts the whole transform against one realistic collection containing every v1 quality, a wishlist item with no `acquiredQuality`, duplicate-by-case locations, empty locations, and three malformed records.

One test, one fixture, asserting: total accounting, location convergence, event count, and `isProvenanceValid` over every produced item.

**Verify:** `npx vitest run packages/core/src/domain/migration.test.ts`
**Commit:** `test(core): assert migration against a realistic mixed v1 fixture`

---

### Task 11: Barrel exports

**Depends on:** Tasks 2, 4, 9 | **Files:** `packages/core/src/index.ts`, `packages/core/src/index.test.ts` | **Category:** integration

Add to `index.ts`, following the file's existing ordering:

```ts
export * from './domain/provenance';
export * from './domain/migration';
```

Types flow through the existing `export * from './types/lego'`.

`index.test.ts` carries an N1 assertion keeping test-only helpers off the public surface. Extend it to assert the new public names are reachable — `isProvenanceValid`, `todayLocalDate`, `migrateV1ToV2` — so a missing barrel line fails a test rather than surfacing as a broken import three steps later.

**Verify:** `npx vitest run packages/core/src/index.test.ts && npm run typecheck`
**Commit:** `feat(core): export provenance and migration from the public barrel`

## Verification

Run before the final commit:

```bash
npm run lint
npm run typecheck
npx vitest run
npm run test -w apps/web    # must stay green: this plan touches no web file
```

The web suite passing unchanged is a real check here, not a formality — it is what proves the expand/contract boundary held.

## Traceability

| Observable truth | Task |
| --- | --- |
| 1, 2, 3 — drop accounting (SC4) | 9, 10 |
| 4 — sealed invariant (SC2) | 2, 6 |
| 5 — unknown is not false (SC3) | 6 |
| 6 — one acquired event per item | 8, 9 |
| 7 — location convergence (SC6) | 7 |
| 8 — no `toISOString` for dates | 4 |

## Soundness review

Run 2026-08-03, `--mode plan`. Converged after one fix pass.

Auto-fixed:

- **P3** — Task 4 modifies `provenance.ts`, created by Task 2, but declared only Task 3. Edge added.
- **P4** — Tasks 7 and 8 both modify `migration.ts` with no edge between them. Task 8 now depends on Task 7.
- **P2** — Tasks 4, 6–11 had no per-task verification command. `Verify:` lines added.
- **Internal consistency** — Task 6's heading named `currentConditionFor`, a function no task defines. Renamed to `provenanceFromV1`.

Surfaced and **dismissed with reason** (P6, warning):

> **P6-001 — `todayLocalDate` (Task 4) has no consumer in this slice.** v1 carries no purchase data, so `migrateV1ToV2` sets every `PurchaseInfo` field to `null` and never calls the helper. Its real caller arrives at step 6 (UI purchase fields). Strict YAGNI says cut it.
>
> Kept deliberately. Task 3 ships `PurchaseInfo`, whose documented contract is a *prohibition* — never derive `purchasedAt` via `toISOString()`. Shipping a prohibition without its correct alternative in the same module is how the prohibition gets violated: the step-6 implementer finds the warning, finds no helper, and reaches for the thing the warning forbids. The helper and its timezone-property test are the enforcement.

## Out of scope, by design

SC1, SC5, SC7–SC11 need persistence, schema, or sync and belong to steps 3–7. SC2 and SC6 are delivered here only in their domain half; their database half (CHECK constraint, `UNIQUE (user_id, normalized_name)`) arrives at step 3.
