# Plan: Rebrickable Bulk CSV Import

**Date:** 2026-06-03 | **Spec:** `docs/changes/rebrickable-csv-import/proposal.md` | **Tasks:** 8 | **Time:** ~35 min

## Gates

- No vague tasks. Every task has exact file paths, exact code, and exact commands.
- No tasks larger than one context window.
- No skipping TDD. Every code-producing task starts with a test.
- No implementation during planning.

---

## Goal

`npm run seed-catalog` downloads Rebrickable's `sets.csv.gz` and `themes.csv.gz`, resolves theme IDs to names, and upserts all LEGO sets into `catalog_cache`. Fixes the "Theme 158" problem. Safe to re-run.

## Observable Truths

1. `npm run seed-catalog` exits 0 and prints `✓ N sets upserted (Xms)`
2. After running: `SELECT DISTINCT theme FROM catalog_cache LIMIT 5` returns names like "Star Wars", not "Theme 158"
3. Running the script a second time succeeds with the same count and no duplicate errors

## Uncertainties

- [ASSUMPTION] Rebrickable CDN URLs: `https://cdn.rebrickable.com/media/downloads/sets.csv.gz` and `https://cdn.rebrickable.com/media/downloads/themes.csv.gz`
- [ASSUMPTION] `sets.csv` columns: `set_num,name,year,theme_id,num_parts,set_img_url`
- [ASSUMPTION] `themes.csv` columns: `id,name,parent_id`
- [DEFERRABLE] Theme hierarchy via `parent_id` — using flat name only for now

---

## File Map

```
CREATE  scripts/seed-catalog.ts
CREATE  scripts/seed-catalog.test.ts
MODIFY  package.json (root)       — add tsx, csv-parse, dotenv devDeps + seed-catalog script
MODIFY  vitest.config.ts          — include scripts/**/*.test.ts
```

---

## Tasks

### Task 1: Setup — dependencies, npm script, vitest include

**Files:**
- Modify: `package.json` (root)
- Modify: `vitest.config.ts`

- [ ] **Step 1: Add devDependencies to root package.json**

Open `package.json` at the repo root and add:

```json
{
  "scripts": {
    "web:dev": "npm run dev -w apps/web",
    "web:build": "npm run build -w apps/web",
    "lint:md": "markdownlint \"*.md\" \"docs/**/*.md\"",
    "supabase:init": "supabase init",
    "seed-catalog": "tsx scripts/seed-catalog.ts"
  },
  "devDependencies": {
    "@postgres-language-server/cli": "^0.24.0",
    "csv-parse": "^5.6.0",
    "dotenv": "^16.4.0",
    "markdownlint-cli": "^0.48.0",
    "supabase": "^2.95.6",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Update vitest.config.ts to include scripts/**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.ts'],
  },
});
```

- [ ] **Step 3: Install dependencies**

```bash
npm install
```

Expected: lock file updated, no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add tsx, csv-parse, dotenv; add seed-catalog script"
```

---

### Task 2: Implement and test `parseThemes`

**Files:**
- Create: `scripts/seed-catalog.ts` (initial, exports only)
- Create: `scripts/seed-catalog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/seed-catalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseThemes } from './seed-catalog';

describe('parseThemes', () => {
  it('builds a map of theme_id to name', () => {
    const csv = `id,name,parent_id\n158,Star Wars,\n171,Technic,`;
    const map = parseThemes(csv);
    expect(map.get('158')).toBe('Star Wars');
    expect(map.get('171')).toBe('Technic');
    expect(map.size).toBe(2);
  });

  it('returns empty map for header-only CSV', () => {
    const csv = `id,name,parent_id\n`;
    expect(parseThemes(csv).size).toBe(0);
  });
});
```

- [ ] **Step 2: Create the initial script file with the function**

Create `scripts/seed-catalog.ts`:

```ts
import { parse } from 'csv-parse/sync';

export function parseThemes(csv: string): Map<string, string> {
  const records = parse(csv, { columns: true, skip_empty_lines: true }) as Array<{
    id: string;
    name: string;
  }>;
  return new Map(records.map((r) => [r.id, r.name]));
}
```

- [ ] **Step 3: Run the tests and verify they pass**

```bash
npx vitest run scripts/seed-catalog.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-catalog.ts scripts/seed-catalog.test.ts
git commit -m "feat(seed): parseThemes — map theme_id to name from themes.csv"
```

---

### Task 3: Implement and test `mapSetRow`

**Files:**
- Modify: `scripts/seed-catalog.ts`
- Modify: `scripts/seed-catalog.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `scripts/seed-catalog.test.ts`:

```ts
import { parseThemes, mapSetRow } from './seed-catalog';

// ... (existing parseThemes tests above)

describe('mapSetRow', () => {
  const themeMap = new Map([['158', 'Star Wars']]);
  const baseRow = {
    set_num: '75313-1',
    name: 'AT-AT',
    year: '2021',
    theme_id: '158',
    num_parts: '6785',
    set_img_url: 'https://img.example.com/75313.jpg',
  };

  it('maps a CSV row to catalog_cache shape', () => {
    expect(mapSetRow(baseRow, themeMap)).toEqual({
      id: 'set-75313-1',
      type: 'set',
      number: '75313-1',
      name: 'AT-AT',
      theme: 'Star Wars',
      year: 2021,
      piece_count: 6785,
      retired: false,
      estimated_value: 0,
      image_url: 'https://img.example.com/75313.jpg',
      barcode: null,
    });
  });

  it('falls back to "Theme N" when theme_id is not in map', () => {
    expect(mapSetRow({ ...baseRow, theme_id: '999' }, themeMap)?.theme).toBe('Theme 999');
  });

  it('returns null for year < 1932', () => {
    expect(mapSetRow({ ...baseRow, year: '0' }, themeMap)).toBeNull();
  });

  it('uses placeholder image when set_img_url is empty', () => {
    const row = mapSetRow({ ...baseRow, set_img_url: '' }, themeMap);
    expect(row?.image_url).toContain('placeholder');
  });

  it('defaults piece_count to 0 when num_parts is empty string', () => {
    const row = mapSetRow({ ...baseRow, num_parts: '' }, themeMap);
    expect(row?.piece_count).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
npx vitest run scripts/seed-catalog.test.ts
```

Expected: mapSetRow tests fail with "mapSetRow is not a function".

- [ ] **Step 3: Implement `mapSetRow` in `scripts/seed-catalog.ts`**

Add after the `parseThemes` function:

```ts
const PLACEHOLDER_IMG = 'https://via.placeholder.com/150?text=No+Image';

interface SetCsvRow {
  set_num: string;
  name: string;
  year: string;
  theme_id: string;
  num_parts: string;
  set_img_url: string;
}

export interface CatalogRow {
  id: string;
  type: 'set';
  number: string;
  name: string;
  theme: string;
  year: number;
  piece_count: number;
  retired: boolean;
  estimated_value: number;
  image_url: string;
  barcode: null;
}

export function mapSetRow(row: SetCsvRow, themeMap: Map<string, string>): CatalogRow | null {
  const year = parseInt(row.year, 10);
  if (year < 1932) return null;
  return {
    id: `set-${row.set_num}`,
    type: 'set',
    number: row.set_num,
    name: row.name,
    theme: themeMap.get(row.theme_id) ?? `Theme ${row.theme_id}`,
    year,
    piece_count: parseInt(row.num_parts, 10) || 0,
    retired: false,
    estimated_value: 0,
    image_url: row.set_img_url || PLACEHOLDER_IMG,
    barcode: null,
  };
}
```

- [ ] **Step 4: Run the tests and verify they all pass**

```bash
npx vitest run scripts/seed-catalog.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-catalog.ts scripts/seed-catalog.test.ts
git commit -m "feat(seed): mapSetRow — map CSV row to catalog_cache shape"
```

---

### Task 4: Implement and test `parseSets`

**Files:**
- Modify: `scripts/seed-catalog.ts`
- Modify: `scripts/seed-catalog.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `scripts/seed-catalog.test.ts`:

```ts
import { parseThemes, mapSetRow, parseSets } from './seed-catalog';

// ... (existing tests above)

describe('parseSets', () => {
  const themeMap = new Map([['158', 'Star Wars']]);

  it('parses a CSV string and resolves theme names', () => {
    const csv = [
      'set_num,name,year,theme_id,num_parts,set_img_url',
      '75313-1,AT-AT,2021,158,6785,https://img.example.com/75313.jpg',
    ].join('\n');
    const rows = parseSets(csv, themeMap);
    expect(rows).toHaveLength(1);
    expect(rows[0].theme).toBe('Star Wars');
    expect(rows[0].id).toBe('set-75313-1');
  });

  it('filters out rows with year < 1932', () => {
    const csv = [
      'set_num,name,year,theme_id,num_parts,set_img_url',
      'bad-0,Old,0,158,0,',
    ].join('\n');
    expect(parseSets(csv, themeMap)).toHaveLength(0);
  });

  it('handles set names with commas', () => {
    const csv = [
      'set_num,name,year,theme_id,num_parts,set_img_url',
      '75312-1,"Boba Fett\'s Starship, Imperial",2021,158,593,',
    ].join('\n');
    const rows = parseSets(csv, themeMap);
    expect(rows[0].name).toBe("Boba Fett's Starship, Imperial");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run scripts/seed-catalog.test.ts
```

Expected: parseSets tests fail with "parseSets is not a function".

- [ ] **Step 3: Implement `parseSets` in `scripts/seed-catalog.ts`**

Add after `mapSetRow`:

```ts
export function parseSets(csv: string, themeMap: Map<string, string>): CatalogRow[] {
  const records = parse(csv, { columns: true, skip_empty_lines: true }) as SetCsvRow[];
  return records.flatMap((r) => {
    const row = mapSetRow(r, themeMap);
    return row ? [row] : [];
  });
}
```

- [ ] **Step 4: Run all tests and verify they pass**

```bash
npx vitest run scripts/seed-catalog.test.ts
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-catalog.ts scripts/seed-catalog.test.ts
git commit -m "feat(seed): parseSets — parse sets.csv with theme resolution"
```

---

### Task 5: Implement `fetchGzippedCsv`

**Files:**
- Modify: `scripts/seed-catalog.ts`

This function is pure I/O — no unit test. It will be exercised by the smoke test in Task 8.

- [ ] **Step 1: Add the import and implement the function**

Add to the top of `scripts/seed-catalog.ts`:

```ts
import https from 'node:https';
import zlib from 'node:zlib';
```

Add after `parseSets`:

```ts
export function fetchGzippedCsv(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const gunzip = zlib.createGunzip();
        const chunks: Buffer[] = [];
        res.pipe(gunzip);
        gunzip.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
        gunzip.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        gunzip.on('error', reject);
        res.on('error', reject);
      })
      .on('error', reject);
  });
}
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
npx vitest run scripts/seed-catalog.test.ts
```

Expected: all 10 tests still pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-catalog.ts
git commit -m "feat(seed): fetchGzippedCsv — download and decompress gzip CSV"
```

---

### Task 6: Implement and test `upsertCatalog`

**Files:**
- Modify: `scripts/seed-catalog.ts`
- Modify: `scripts/seed-catalog.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `scripts/seed-catalog.test.ts`:

```ts
import { vi } from 'vitest';
import { parseThemes, mapSetRow, parseSets, upsertCatalog } from './seed-catalog';

// ... (existing tests above)

describe('upsertCatalog', () => {
  function makeRow(i: number): CatalogRow {
    return {
      id: `set-test-${i}`, type: 'set', number: `${i}`, name: `Set ${i}`,
      theme: 'Test', year: 2020, piece_count: 10, retired: false,
      estimated_value: 0, image_url: '', barcode: null,
    };
  }

  it('calls supabase upsert with batches of 1000', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) } as any;
    const rows = Array.from({ length: 2500 }, (_, i) => makeRow(i));
    const count = await upsertCatalog(rows, client);
    expect(count).toBe(2500);
    expect(mockUpsert).toHaveBeenCalledTimes(3); // 1000 + 1000 + 500
  });

  it('throws on Supabase error', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      }),
    } as any;
    await expect(upsertCatalog([makeRow(0)], client)).rejects.toThrow('DB error');
  });

  it('returns 0 for empty input without calling supabase', async () => {
    const client = { from: vi.fn() } as any;
    const count = await upsertCatalog([], client);
    expect(count).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });
});
```

You will also need to import `CatalogRow` in the test file. Add to the import line:

```ts
import { parseThemes, mapSetRow, parseSets, upsertCatalog, type CatalogRow } from './seed-catalog';
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run scripts/seed-catalog.test.ts
```

Expected: upsertCatalog tests fail.

- [ ] **Step 3: Add the import and implement `upsertCatalog`**

Add to the imports at the top of `scripts/seed-catalog.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
```

Add after `fetchGzippedCsv`:

```ts
export async function upsertCatalog(
  rows: CatalogRow[],
  client: SupabaseClient,
): Promise<number> {
  const BATCH = 1000;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await client
      .from('catalog_cache')
      .upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    count += batch.length;
  }
  return count;
}
```

- [ ] **Step 4: Run all tests and verify they pass**

```bash
npx vitest run scripts/seed-catalog.test.ts
```

Expected: 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-catalog.ts scripts/seed-catalog.test.ts
git commit -m "feat(seed): upsertCatalog — batched upsert to catalog_cache"
```

---

### Task 7: Wire the main entry point

**Files:**
- Modify: `scripts/seed-catalog.ts`

No new tests — this is the integration entry point. Tested via smoke test in Task 8.

- [ ] **Step 1: Add dotenv import and the main function**

Add to the top of `scripts/seed-catalog.ts`:

```ts
import dotenv from 'dotenv';
dotenv.config();
```

Append to the bottom of `scripts/seed-catalog.ts`:

```ts
const SETS_URL = 'https://cdn.rebrickable.com/media/downloads/sets.csv.gz';
const THEMES_URL = 'https://cdn.rebrickable.com/media/downloads/themes.csv.gz';

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Error: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set in .env',
    );
    process.exit(1);
  }

  const client = createClient(supabaseUrl, serviceRoleKey);
  const start = Date.now();

  console.log('Fetching themes...');
  const themesCsv = await fetchGzippedCsv(THEMES_URL);
  const themeMap = parseThemes(themesCsv);
  console.log(`  Loaded ${themeMap.size} themes`);

  console.log('Fetching sets...');
  const setsCsv = await fetchGzippedCsv(SETS_URL);
  const rows = parseSets(setsCsv, themeMap);
  console.log(`  Parsed ${rows.length} sets`);

  console.log('Upserting to Supabase...');
  const count = await upsertCatalog(rows, client);
  console.log(`✓ ${count} sets upserted (${Date.now() - start}ms)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify tests still pass (dotenv.config() at module level is fine in test env)**

```bash
npx vitest run scripts/seed-catalog.test.ts
```

Expected: all 13 tests still pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-catalog.ts
git commit -m "feat(seed): wire main entry point for seed-catalog script"
```

---

### Task 8: Add SUPABASE_SERVICE_ROLE_KEY and smoke test

**[checkpoint:human-action]** This task requires a manual step.

- [ ] **Step 1: Get the service role key from Supabase dashboard**

Go to your Supabase project → Settings → API → `service_role` key (under "Project API keys"). Copy it.

- [ ] **Step 2: Add the key to `.env`**

Open `.env` and add:

```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as-is. Do not commit `.env`.

- [ ] **Step 3: Run the seed script**

```bash
npm run seed-catalog
```

Expected output:
```
Fetching themes...
  Loaded ~1800 themes
Fetching sets...
  Parsed ~24000 sets
Upserting to Supabase...
✓ 24000 sets upserted (NNNNms)
```

- [ ] **Step 4: Verify theme names in the database**

```bash
npx supabase db shell --project-ref <your-project-ref>
```
Then run:
```sql
SELECT DISTINCT theme FROM catalog_cache WHERE theme NOT LIKE 'Theme %' LIMIT 10;
```

Expected: rows like `Star Wars`, `City`, `Technic`, etc.

- [ ] **Step 5: Run the script a second time to verify idempotency**

```bash
npm run seed-catalog
```

Expected: same count, no errors, no duplicate key violations.

---

## Summary

| Task | Description | Time |
|---|---|---|
| 1 | Setup — deps, npm script, vitest config | 3 min |
| 2 | `parseThemes` — theme_id to name map | 4 min |
| 3 | `mapSetRow` — CSV row to catalog_cache shape | 5 min |
| 4 | `parseSets` — full CSV parsing with theme resolution | 4 min |
| 5 | `fetchGzippedCsv` — download + decompress | 3 min |
| 6 | `upsertCatalog` — batched Supabase upsert | 5 min |
| 7 | Main entry point wiring | 4 min |
| 8 | Smoke test + DB verification [human-action] | 5 min |

**Total:** ~33 minutes
