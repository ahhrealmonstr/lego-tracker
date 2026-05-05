---
type: business_concept
domain: domain
tags: [catalog, search, barcode]
related: [catalog.ts, domain]
---

# Catalog Search and Lookup

The catalog module in `src/domain/catalog.ts` provides search and lookup for the seeded LEGO catalog.

## seedCatalog

`seedCatalog` is a constant array of `LegoCatalogItem` objects. Contains 6 entries: 4 sets (Lion Knights Castle `10305`, Tree House `21318`, AT-AT `75313`, Titanic `10294`) and 2 minifigs (Battle Droid `sw0001c`, Lion Knight `cas565`). Each entry has `id`, `type`, `number`, `name`, `theme`, `year`, `pieceCount`, `retired`, `estimatedValue`, `imageUrl`, and optional `barcode`.

## searchCatalog

`searchCatalog` takes a query string and filters `seedCatalog` by matching against `number`, `name`, `theme`, `type`, and `barcode` fields. Empty query returns all items. Comparison is case-insensitive after trimming whitespace.

Used by `filteredCatalog` in `App` component in `src/api/main.tsx`.

## findCatalogItem

`findCatalogItem` looks up a catalog entry by `id`. Returns `undefined` if not found.

Used by `selectedCatalogItem` derivation in `App`.

## findByBarcode

`findByBarcode` matches a barcode string against catalog entries. Trims whitespace before comparison. Returns `undefined` if no match.

Used by `handleBarcode` in `App` and by `BarcodeScanner` via `onDetected` callback.
