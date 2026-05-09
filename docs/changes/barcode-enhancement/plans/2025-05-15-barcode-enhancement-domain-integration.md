# Plan: Barcode Enhancement - Domain Layer Integration

**Date:** 2025-05-15 | **Spec:** docs/changes/barcode-enhancement/proposal.md | **Tasks:** 5 | **Time:** 25 min | **Integration Tier:** medium

## Goal

Integrate multi-source barcode lookup (Seed -> Cache -> Rebrickable) into the `catalog` domain layer with automatic caching, as described in Phase 2 of the enhancement specification.

## Observable Truths (Acceptance Criteria)

1. [Ubiquitous] When `findByBarcode` is called, the system shall return a match from `seedCatalog` if present.
2. [State-driven] If no match is in `seedCatalog`, the system shall query the Supabase `catalog_cache` table by barcode using `getCachedItemByBarcode`.
3. [State-driven] If no match is in cache, the system shall query the Rebrickable API via `findRebrickableByBarcode`.
4. [Event-driven] When an item is retrieved from Rebrickable, the system shall call `cacheCatalogItem` to store it in the Supabase cache.
5. [Ubiquitous] The system shall return `undefined` if the barcode is not found in any source.
6. [Ubiquitous] All existing and new tests in `packages/core` shall pass.

## File Map

- MODIFY `packages/core/src/services/supabase.ts` (Add `getCachedItemByBarcode`)
- CREATE `packages/core/src/services/supabase.test.ts` (Unit tests for Supabase service)
- MODIFY `packages/core/src/domain/catalog.ts` (Update `findByBarcode` implementation)
- CREATE `packages/core/src/domain/catalog.test.ts` (Unit tests for Catalog domain)

## Tasks

### Task 1: Add `getCachedItemByBarcode` to Supabase service

**Depends on:** none | **Files:** `packages/core/src/services/supabase.ts`

1. Open `packages/core/src/services/supabase.ts`.
2. Add the following function after `getCachedItem`:

    ```typescript
    export async function getCachedItemByBarcode(barcode: string): Promise<LegoCatalogItem | null> {
      const supabase = getClient();
      if (!supabase) return null;

      const { data, error } = await supabase
        .from('catalog_cache')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        type: data.type as any,
        number: data.number,
        name: data.name,
        theme: data.theme,
        year: data.year,
        pieceCount: data.piece_count,
        retired: false,
        estimatedValue: 0,
        imageUrl: data.image_url,
        barcode: data.barcode,
      };
    }
    ```

3. Run: `harness validate`
4. Commit: `feat(core): add getCachedItemByBarcode to supabase service`

### Task 2: Create unit tests for Supabase service

**Depends on:** Task 1 | **Files:** `packages/core/src/services/supabase.test.ts`

1. Create `packages/core/src/services/supabase.test.ts` with tests for `getCachedItemByBarcode`.
2. Mock `@supabase/supabase-js` to simulate successful and empty cache hits.
3. Run: `npx vitest packages/core/src/services/supabase.test.ts`
4. Run: `harness validate`
5. Commit: `test(core): add tests for getCachedItemByBarcode`

### Task 3: Setup domain tests for `findByBarcode`

**Depends on:** Task 1 | **Files:** `packages/core/src/domain/catalog.test.ts`

1. Create `packages/core/src/domain/catalog.test.ts`.
2. Add tests for `findByBarcode` covering:
    - Hits in `seedCatalog`.
    - Miss in `seedCatalog`, hit in cache.
    - Miss in seed and cache, hit in Rebrickable (verify caching called).
    - Miss everywhere.
3. Mock `../services/supabase` and `../services/rebrickable`.
4. Run tests — observe failure for async/multi-source logic.
5. Commit: `test(core): add failing tests for enhanced findByBarcode`

### Task 4: Implement enhanced `findByBarcode`

**Depends on:** Task 3 | **Files:** `packages/core/src/domain/catalog.ts`

1. Update `packages/core/src/domain/catalog.ts`.
2. Update imports to include `findRebrickableByBarcode` and `getCachedItemByBarcode`.
3. Implement the multi-source lookup logic in `findByBarcode`:

    ```typescript
    export async function findByBarcode(barcode: string): Promise<LegoCatalogItem | undefined> {
      const cleaned = barcode.trim();
      
      // 1. Check seed catalog
      const local = seedCatalog.find((item) => item.barcode === cleaned);
      if (local) return local;

      // 2. Check cache
      const cached = await getCachedItemByBarcode(cleaned);
      if (cached) return cached;

      // 3. Check Rebrickable
      const external = await findRebrickableByBarcode(cleaned);
      if (external) {
        // 4. Cache it in the background
        await cacheCatalogItem(external);
        return external;
      }

      return undefined;
    }
    ```

4. Run: `npx vitest packages/core/src/domain/catalog.test.ts` — observe pass.
5. Run: `harness validate`
6. Commit: `feat(core): implement multi-source lookup in findByBarcode`

### Task 5: Final validation and project health check

**Depends on:** Task 4 | **Files:** none

1. Run all tests in `packages/core`: `npx vitest packages/core`
2. Run `harness validate`.
3. Commit: `chore: finalize barcode enhancement domain integration`
