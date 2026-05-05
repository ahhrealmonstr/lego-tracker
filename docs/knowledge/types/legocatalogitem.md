---
type: business_term
domain: types
tags: [interface, types]
related: [lego.ts]
---

# LegoCatalogItem

The `LegoCatalogItem` interface in `src/types/lego.ts` defines the shape of catalog entries. Every item in `seedCatalog` conforms to this interface. Fields: `id`, `type` (LegoItemType), `number`, `name`, `theme`, `year`, `pieceCount`, `retired`, `estimatedValue`, `imageUrl`, and optional `barcode`.

Used by `searchCatalog`, `findCatalogItem`, and `findByBarcode` in `src/domain/catalog.ts`. Extended by `OwnedLegoItem` to add ownership tracking.
