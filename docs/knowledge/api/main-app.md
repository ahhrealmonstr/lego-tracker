---
type: business_concept
domain: api
tags: [react, app, components, state]
related: [main.tsx, api]
---

# Main Application Components

The `apps/web/src/api/main.tsx` file contains the React entry point and all UI components for Brick Ledger.

## App

`App` is the main component managing all application state: `query` for search, `items` for owned items (initialized from `loadCollection`), `activeView` for tab state (ViewMode: `'catalog'`, `'collection'`, or `'wishlist'`), `selectedItemId` for the currently selected item, `scannerOpen` for barcode scanner visibility, and `scanMessage` for scan feedback.

Key derived values: `summary` (via `useMemo` with `summarizeCollection`), `selectedOwnedItem`, `selectedCatalogItem`, `selectedItem`, `filteredCatalog` (via `useMemo` with `searchCatalog`), and `visibleOwnedItems`.

Actions: `addItem` creates owned items via `createOwnedItem` and upserts, `updateSelectedItem` patches owned items via `upsertOwnedItem`, `removeSelectedItem` filters out the selected item, and `handleBarcode` processes barcode detection by calling `findByBarcode` and either adding the matched item or filling the search query.

Renders `Stat` components for summary counters, a search toolbar with barcode button, tab navigation (`Catalog`, `Collection`, `Wishlist`), `ItemList`, `DetailPanel`, and `BarcodeScanner`.

## Stat

`Stat` renders a single summary counter with label, value, and icon. Used in the summary grid for `Owned`, `Wishlist`, `Value`, and `Built` counters.

## ItemList

`ItemList` displays either `catalogItems` or `ownedItems` based on `activeView`. Each row shows the item image, number, type (via `itemTypeLabels`), name, and theme. Catalog view shows an add button per row. Supports selection via `onSelect` callback and direct add via `onAdd`.

## DetailPanel

`DetailPanel` shows the selected item's full details. For catalog items: hero image, heading with type/number, name, theme/year/pieceCount, value badge, retired badge, and add to collection/wishlist buttons. For owned items (when `ownedItem` is present): editable form with fields for List (status), Set quality when bought (acquiredQuality), Building status (buildStatus), Display location, Quantity, Box saved checkbox, Missing parts textarea, Notes textarea, and a Remove from lists button.

## Field

`Field` is a small layout wrapper for form labels and inputs used in `DetailPanel`.

## BarcodeScanner

`BarcodeScanner` is a modal component that handles barcode detection. Starts camera stream with `navigator.mediaDevices.getUserMedia` if `canUseBarcodeDetector` returns true. Polls `scanVideoFrame` every 350ms. Falls back to manual barcode input. Calls `onDetected` with the scanned or entered barcode. Cleans up camera stream and timeout on unmount.

## formatCurrency

`formatCurrency` formats a number as USD currency using `Intl.NumberFormat`. Used to display `estimatedValue` in `DetailPanel` and `totalEstimatedValue` in the Value `Stat`.

## ViewMode

`ViewMode` type is `'collection'` | `'wishlist'` | `'catalog'`, used for `activeView` state in `App`.
