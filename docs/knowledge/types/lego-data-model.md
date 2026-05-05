---
type: business_concept
domain: types
tags: [data-model, catalog, types]
related: [lego.ts, domain/catalog.ts]
---

# Lego Data Model

The Brick Ledger data model is defined in `src/types/lego.ts` and shared across all layers.

## Core Types

### LegoItemType

The `LegoItemType` type distinguishes between `'set'` and `'minifig'` catalog entries. Used by `LegoCatalogItem` and rendered with labels from `itemTypeLabels` in `src/domain/options.ts`.

### LegoCatalogItem

`LegoCatalogItem` is the base interface for all LEGO items in the catalog. It includes:

- `id`: Unique identifier (e.g., `set-10305`, `fig-sw0001c`)
- `type`: The `LegoItemType` — either `'set'` or `'minifig'`
- `number`: Set number or minifig number (e.g., `10305`, `sw0001c`)
- `name`: Display name (e.g., `Lion Knights Castle`)
- `theme`: Theme name (e.g., `Icons`, `Star Wars`, `Castle`)
- `year`: Release year
- `pieceCount`: Number of pieces
- `retired`: Whether the item is retired
- `estimatedValue`: Estimated retail value in USD
- `imageUrl`: URL to the item's image
- `barcode`: Optional barcode string for scanning

The catalog is seeded in `seedCatalog` in `src/domain/catalog.ts` and searched via `searchCatalog` and `findByBarcode`.

### OwnedLegoItem

`OwnedLegoItem` extends `LegoCatalogItem` with ownership tracking fields:

- `status`: The `CollectionStatus` — either `'collection'` or `'wishlist'`
- `acquiredQuality`: The `AcquisitionQuality` at purchase time
- `savedBox`: Whether the original box was kept
- `buildStatus`: The `BuildStatus` — `'not-started'`, `'in-progress'`, or `'complete'`
- `displayLocation`: Where the item is displayed or stored
- `notes`: Freeform ownership notes
- `missingParts`: Missing part IDs, colors, or notes
- `quantity`: Number of duplicates
- `addedAt`: ISO timestamp when first added
- `updatedAt`: ISO timestamp of last modification

Created by `createOwnedItem` in `src/domain/collection.ts` and persisted by `saveCollection` in `src/services/storage.ts`.

### CollectionSummary

`CollectionSummary` aggregates the collection state:

- `collectionCount`: Number of items with `status === 'collection'`
- `wishlistCount`: Number of items with `status === 'wishlist'`
- `totalEstimatedValue`: Sum of `estimatedValue * quantity` for collection items
- `completeBuilds`: Count of items with `buildStatus === 'complete'`

Computed by `summarizeCollection` in `src/domain/collection.ts`.

## Status and Quality Enums

### CollectionStatus

`CollectionStatus` is `'collection'` or `'wishlist'`. Labels provided by `statusLabels` in `src/domain/options.ts`.

### AcquisitionQuality

`AcquisitionQuality` records the condition at purchase: `'new'`, `'new-open-box'`, `'used-with-box-instructions'`, `'used-no-box'`, `'used-no-instructions'`, or `'used-missing-parts'`. Labels provided by `qualityLabels`.

### BuildStatus

`BuildStatus` tracks assembly progress: `'not-started'`, `'in-progress'`, or `'complete'`. Labels provided by `buildStatusLabels`.

## Validation

The `isOwnedLegoItem` function in `src/services/storage.ts` validates loaded data against all these types before returning from `loadCollection`. It checks every field using `isOneOf` for enum types.
