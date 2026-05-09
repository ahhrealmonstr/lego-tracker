---
type: business_concept
domain: domain
tags: [collection, ownership, state]
related: [collection.ts, domain]
---

# Collection Management

The collection module in `packages/core/src/domain/collection.ts` manages owned LEGO items — creation, updates, and summary aggregation.

## createOwnedItem

`createOwnedItem` takes a `LegoCatalogItem` and a `CollectionStatus` (`'collection'` or `'wishlist'`) and returns a new `OwnedLegoItem`. Sets defaults: `acquiredQuality` to `'new'` for collection or `'used-with-box-instructions'` for wishlist, `savedBox` to `true`, `buildStatus` to `'not-started'`, `quantity` to `1`, and timestamps to current ISO string.

Called by `addItem` in `App` component in `apps/web/src/app/App.tsx`.

## upsertOwnedItem

`upsertOwnedItem` takes the current `OwnedLegoItem[]` array and a `nextItem`. If the item ID already exists, it updates the existing entry (merging with `updatedAt` refreshed). If new, it prepends to the array. Always updates `updatedAt` to current ISO string.

Called by `addItem` and `updateSelectedItem` in `App`.

## summarizeCollection

`summarizeCollection` computes a `CollectionSummary` from `OwnedLegoItem[]`:

- `collectionCount`: filters by `status === 'collection'`
- `wishlistCount`: filters by `status === 'wishlist'`
- `totalEstimatedValue`: sums `estimatedValue * quantity` for collection items only
- `completeBuilds`: counts items with `buildStatus === 'complete'`

Called via `useMemo` as `summary` in `App` and rendered in `Stat` components.
