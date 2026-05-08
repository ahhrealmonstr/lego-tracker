---
type: business_concept
domain: services
tags: [storage, persistence, localStorage, validation]
related: [storage.ts, services]
---

# LocalStorage Persistence

The storage module in `apps/web/src/services/storage.ts` handles browser localStorage persistence for the LEGO collection.

## storageKey

`storageKey` is the localStorage key `'brick-ledger.collection.v1'`. All collection data is stored under this single key as JSON.

## loadCollection

`loadCollection` reads from localStorage using `storageKey`. Returns empty array if key is missing or JSON is invalid. Parses JSON and filters entries through `isOwnedLegoItem` to reject malformed data. Called on app initialization in `App` via `useState` initializer and ensures corrupted localStorage data never reaches the UI.

## saveCollection

`saveCollection` writes an `OwnedLegoItem[]` array to localStorage under `storageKey` as JSON. Called via `useEffect` in `App` whenever `items` state changes.

## isOwnedLegoItem

`isOwnedLegoItem` is a type guard that validates an unknown value against the `OwnedLegoItem` interface. Checks every field: `id` (string), `type` (one of `itemTypes`), `number` (string), `name` (string), `theme` (string), `year` (number), `pieceCount` (number), `retired` (boolean), `estimatedValue` (number), `imageUrl` (string), `barcode` (optional string), `status` (one of `collectionStatuses`), `acquiredQuality` (one of `acquisitionQualities`), `savedBox` (boolean), `buildStatus` (one of `buildStatuses`), `displayLocation` (string), `notes` (string), `missingParts` (string), `quantity` (number), `addedAt` (string), `updatedAt` (string).

## Helper Functions

`isObject` checks if a value is a non-null object. `isOneOf` checks if a string value is in a readonly array of options — used for enum validation in `isOwnedLegoItem`.

## Validation Arrays

`itemTypes`, `collectionStatuses`, `acquisitionQualities`, and `buildStatuses` are readonly string arrays mirroring the TypeScript enum types, used by `isOwnedLegoItem` for runtime validation.
