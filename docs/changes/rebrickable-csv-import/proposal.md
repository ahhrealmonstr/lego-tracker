# Rebrickable Bulk CSV Import

## Summary

A local Node.js script (`npm run seed-catalog`) that downloads Rebrickable's public bulk CSV files, resolves theme IDs to human-readable names, and upserts the full LEGO set catalog into `catalog_cache`. Fixes the "Theme 158" problem where the Rebrickable API only returns numeric theme IDs.

## Status

planned

## Milestone

M6

---

## Requirements

- Running `npm run seed-catalog` upserts all sets from Rebrickable's `sets.csv` into `catalog_cache`
- Theme names are resolved from `themes.csv` (e.g., theme_id 158 → "Star Wars")
- Script is idempotent — running twice produces the same result, no duplicates or errors
- Existing rows are updated (upsert), not skipped, so data stays fresh on re-runs
- Sets with invalid years (< 1932) are filtered out to satisfy the DB constraint
- Script reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env`
- No Rebrickable API key required — bulk CSVs are on a public CDN

## Out of Scope

- `inventory_parts.csv` (~200MB) — on-demand per-set fetch already handles parts
- Theme hierarchy / full path (parent_id recursion) — flat name only
- Minifig import — sets only
- Scheduled automation — run manually or add to CI later

## Architecture

```
npm run seed-catalog
  → scripts/seed-catalog.ts
      ├── fetchGzippedCsv(THEMES_URL) → parseThemes() → Map<id, name>
      ├── fetchGzippedCsv(SETS_URL)   → parseSets(themeMap) → CatalogRow[]
      └── upsertCatalog(rows, supabaseClient)  [batched, 1000/batch]
```

## Data Sources

- `https://cdn.rebrickable.com/media/downloads/themes.csv.gz`
- `https://cdn.rebrickable.com/media/downloads/sets.csv.gz`

Both are public (no API key required). Updated by Rebrickable periodically.
