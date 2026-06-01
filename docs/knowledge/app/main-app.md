---
type: business_concept
domain: app
tags: [react, app, components, state]
related: [main.tsx, api]
---

# Main Application Components

The `apps/web/src/app/index.tsx` is the React entry point. The core application logic is in `apps/web/src/app/App.tsx`, with UI components located in `apps/web/src/components/`.

## App

`App` (in `App.tsx`) is the main container component managing application state: `query` for search, `items` for owned items (initialized from `loadCollection`), `activeView` for tab state (ViewMode: `'catalog'`, `'collection'`, or `'wishlist'`), `selectedItemId` for the currently selected item, `scannerOpen` for barcode scanner visibility, and `scanMessage` for scan feedback.

Key derived values: `summary` (via `useMemo` with `summarizeCollection`), `selectedOwnedItem`, `selectedCatalogItem`, `selectedItem`, `catalogResults` (search results updated by a 300ms debounced effect), and `visibleOwnedItems`.

Actions: `addItem` creates owned items via `createOwnedItem`, upserts them, and calls `enqueueMutation({ type: 'upsert' })`. `updateSelectedItem` patches owned items and enqueues an upsert with a fresh `updatedAt`. `removeSelectedItem` filters out the selected item and enqueues `{ type: 'delete' }`. `handleBarcode` processes barcode detection by calling `findByBarcode` and either adding the matched item or filling the search query.

Sync: `App` calls `useSync()` to obtain `{ status: SyncStatus, triggerSync }`. The `SyncStatus` component is rendered in the sidebar to show syncing/offline/error states. There is no manual sync button — reconciliation happens automatically on load, every 5 minutes, and on reconnect.

Renders `Stat` components for summary counters, `SyncStatus` for sync state, a search toolbar with barcode button, tab navigation (`Catalog`, `Collection`, `Wishlist`), `ItemList`, `DetailPanel`, and `BarcodeScanner`.

## Stat

`Stat` (in `components/Stat.tsx`) renders a single summary counter with label, value, and icon. Used in the summary grid for `Owned`, `Wishlist`, `Value`, and `Built` counters.

## ItemList

`ItemList` (in `components/ItemList.tsx`) displays either `catalogItems` or `ownedItems` based on `activeView`. Each row shows the item image, number, type (via `itemTypeLabels`), name, and theme. Catalog view shows an add button per row. Supports selection via `onSelect` callback and direct add via `onAdd`.

## DetailPanel

`DetailPanel` (in `components/DetailPanel.tsx`) shows the selected item's full details. For catalog items: hero image, heading with type/number, name, theme/year/pieceCount, value badge, retired badge, and add to collection/wishlist buttons. For owned items (when `ownedItem` is present): editable form with fields for List (status), Set quality when bought (acquiredQuality), Building status (buildStatus), Display location, Quantity, Box saved checkbox, Missing parts textarea, Notes textarea, and a Remove from lists button.

## Field

`Field` is a small layout wrapper for form labels and inputs used in `DetailPanel`.

## BarcodeScanner

`BarcodeScanner` (in `components/BarcodeScanner.tsx`) is a modal component that handles barcode detection. Starts camera stream with `navigator.mediaDevices.getUserMedia` if `canUseBarcodeDetector` returns true. Polls `scanVideoFrame` every 350ms. Falls back to manual barcode input. Calls `onDetected` with the scanned or entered barcode. Cleans up camera stream and timeout on unmount.

## formatCurrency

`formatCurrency` formats a number as USD currency using `Intl.NumberFormat`. Used to display `estimatedValue` in `DetailPanel` and `totalEstimatedValue` in the Value `Stat`.

## ViewMode

`ViewMode` type is `'collection'` | `'wishlist'` | `'catalog'`, used for `activeView` state in `App`.
