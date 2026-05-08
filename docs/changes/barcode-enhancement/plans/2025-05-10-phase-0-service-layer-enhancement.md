# Plan: Phase 0: Service Layer Enhancement

**Date:** 2025-05-10 | **Spec:** `docs/changes/barcode-enhancement/proposal.md` | **Tasks:** 5 | **Time:** 20 min | **Integration Tier:** medium

## Goal

Implement `findRebrickableByBarcode` in the Rebrickable service to support external barcode lookups, as defined in Phase 1 of the enhancement spec.

## Observable Truths (Acceptance Criteria)

1. [Ubiquitous] The `findRebrickableByBarcode` function shall return a `LegoCatalogItem` or `null`.
2. [Event-driven] When `findRebrickableByBarcode` is called with a valid LEGO barcode (e.g., `5702016913484`), the system shall return the corresponding catalog item fetched from the Rebrickable API.
3. [Event-driven] When the Rebrickable API returns an error or no match, the system shall return `null`.
4. [State-driven] While the Rebrickable API key is missing, the system shall return `null` without making a network request.
5. [Ubiquitous] `harness validate` passes.

## File Map

- MODIFY `packages/core/package.json` (add vitest)
- MODIFY `packages/core/src/services/rebrickable.ts` (add `findRebrickableByBarcode`)
- CREATE `packages/core/src/services/rebrickable.test.ts` (new tests)

## Tasks

### Task 1: Add Vitest to core package

**Depends on:** none | **Files:** `packages/core/package.json`

1. Update `packages/core/package.json` to include `vitest`:

   ```json
   "scripts": {
     "test": "vitest run"
   },
   "devDependencies": {
     "typescript": "^5.9.3",
     "vite": "^6.4.2",
     "vitest": "^3.0.0"
   }
   ```

2. Run: `npm install -w packages/core`
3. Run: `harness validate`
4. Commit: `chore(core): add vitest for service layer testing`

### Task 2: Create rebrickable service tests with mocks

**Depends on:** Task 1 | **Files:** `packages/core/src/services/rebrickable.test.ts`

1. Create `packages/core/src/services/rebrickable.test.ts` with mocks for `fetch` and `getConfig`.
2. Add a basic test to verify `searchRebrickable` (existing functionality).
3. Run: `npx vitest packages/core/src/services/rebrickable.test.ts`
4. Run: `harness validate`
5. Commit: `test(rebrickable): add test infrastructure and initial mocks`

### Task 3: Write failing test for findRebrickableByBarcode

**Depends on:** Task 2 | **Files:** `packages/core/src/services/rebrickable.test.ts`

1. Add a test case for the new function:

   ```typescript
   it('should find an item by barcode', async () => {
     // @ts-ignore - function not yet implemented
     const item = await findRebrickableByBarcode('5702016913484');
     expect(item?.number).toBe('75312');
   });
   ```

2. Run: `npx vitest packages/core/src/services/rebrickable.test.ts` — Observe failure (function undefined).
3. Run: `harness validate`
4. Commit: `test(rebrickable): add failing test for barcode lookup`

### Task 4: Implement findRebrickableByBarcode

**Depends on:** Task 3 | **Files:** `packages/core/src/services/rebrickable.ts`

1. Implement the function in `packages/core/src/services/rebrickable.ts`:

   ```typescript
   export async function findRebrickableByBarcode(barcode: string): Promise<LegoCatalogItem | null> {
     const results = await fetchFromRebrickable('/sets/', { barcode: barcode.trim() });
     if (results && results.length > 0) {
       return mapToCatalogItem(results[0], 'set');
     }
     return null;
   }
   ```

2. Run: `npx vitest packages/core/src/services/rebrickable.test.ts` — Observe pass.
3. Run: `harness validate`
4. Commit: `feat(rebrickable): implement findRebrickableByBarcode`

### Task 5: Add error handling for rate limits

**Depends on:** Task 4 | **Files:** `packages/core/src/services/rebrickable.ts`, `packages/core/src/services/rebrickable.test.ts`

1. Add a test case for 429 status code.
2. Update `fetchFromRebrickable` in `packages/core/src/services/rebrickable.ts` to log rate limits:

   ```typescript
   if (response.status === 429) {
     console.warn('Rebrickable API rate limit exceeded');
     return [];
   }
   ```

3. Run: `npx vitest packages/core/src/services/rebrickable.test.ts`
4. Run: `harness validate`
5. Commit: `feat(rebrickable): add rate limit handling to fetch helper`
