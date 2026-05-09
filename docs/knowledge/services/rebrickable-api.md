---
type: business_concept
domain: services
tags: [rebrickable, api, catalog, sets, minifigs]
related: [rebrickable.ts, catalog.ts]
---

# Rebrickable API Service

The Rebrickable service module in `packages/core/src/services/rebrickable.ts` provides integration with the [Rebrickable API](https://rebrickable.com/api/) to fetch LEGO set and minifigure data.

## Configuration

Requires `VITE_REBRICKABLE_API_KEY` to be set in the environment (configured via `packages/core/src/config.ts`). If the key is missing, all service functions return empty results or `null` without making network requests.

## searchRebrickable

`searchRebrickable` performs a broad search across both sets and minifigures using a query string. It returns a combined array of `LegoCatalogItem` objects, limited to 10 sets and 5 minifigures.

## findRebrickableByBarcode

`findRebrickableByBarcode` looks up an item by its EAN/UPC barcode. It first checks the `/sets/` endpoint and, if no match is found, falls back to the `/minifigs/` endpoint. This supports both boxed sets and standalone minifigure packs.

## findRebrickableItem

`findRebrickableItem` retrieves full details for a specific set or minifigure using its unique number and type.

## Error Handling

- **Rate Limiting (429)**: The service automatically detects 429 status codes, logs a warning, and returns empty results to prevent application crashes.
- **Network Failures**: Caught and logged, returning safe defaults.
