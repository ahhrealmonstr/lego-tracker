---
type: business_term
domain: types
tags: [interface, types]
related: [lego.ts]
---

# OwnedLegoItem

The `OwnedLegoItem` interface in `src/types/lego.ts` extends `LegoCatalogItem` with ownership fields: `status` (CollectionStatus), `acquiredQuality` (AcquisitionQuality), `savedBox`, `buildStatus` (BuildStatus), `displayLocation`, `notes`, `missingParts`, `quantity`, `addedAt`, and `updatedAt`.

Created by `createOwnedItem` in `src/domain/collection.ts`. Persisted and validated by `saveCollection`, `loadCollection`, and `isOwnedLegoItem` in `src/services/storage.ts`.
