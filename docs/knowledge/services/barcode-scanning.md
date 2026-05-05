---
type: business_concept
domain: services
tags: [barcode, scanning, camera]
related: [barcode.ts, services]
---

# Barcode Scanning Service

The barcode module in `src/services/barcode.ts` wraps the browser BarcodeDetector API for camera-based barcode scanning.

## canUseBarcodeDetector

`canUseBarcodeDetector` returns `true` if `window.BarcodeDetector` is available. Used in `BarcodeScanner` component in `src/api/main.tsx` to determine whether to show camera scanning or manual input.

## scanVideoFrame

`scanVideoFrame` takes an `HTMLVideoElement` and runs barcode detection on the current frame. Creates a `BarcodeDetector` with formats `ean_13`, `upc_a`, `code_128`, and `qr_code`. Returns the first detected barcode's `rawValue` or `null` if nothing is detected.

Called in a polling loop inside `BarcodeScanner`'s `useEffect`, scanning every 350ms while the scanner is open and active.

## BarcodeDetector Type

The module declares a global `Window` interface extension for `BarcodeDetector` with a `detect` method that accepts `CanvasImageSource | Blob | ImageData` and returns an array of `{ rawValue: string }` results.
