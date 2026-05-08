# Plan: Phase 2: UI Feedback & Verification

**Date:** 2025-05-20 | **Spec:** `docs/changes/barcode-enhancement/proposal.md` | **Tasks:** 5 | **Time:** 25 min | **Integration Tier:** medium

## Goal

Provide user feedback during asynchronous barcode lookups and ensure the UI remains responsive and informative.

## Observable Truths (Acceptance Criteria)

1.  **Event-driven:** When a barcode is scanned, the system shall display a loading indicator in the scanner modal until the lookup completes.
2.  **State-driven:** While searching for a barcode, the system shall disable manual search buttons in the scanner modal to prevent concurrent requests.
3.  **Ubiquitous:** The system shall display clear, accurate messages for found items and items not found in any source (seed catalog, cache, or Rebrickable).
4.  **Event-driven:** When an item is found via barcode, the system shall close the scanner modal and add the item to the collection.
5.  **Unwanted:** If the barcode lookup fails due to a network error, the system shall not crash and shall display an error message to the user.

## File Map

- MODIFY `apps/web/src/api/main.tsx`
- MODIFY `apps/web/src/api/styles.css`

## Tasks

### Task 1: Add scanning state to App component

**Depends on:** none | **Files:** `apps/web/src/api/main.tsx`

1.  Open `apps/web/src/api/main.tsx`.
2.  In the `App` component, add a new state: `const [isScanningBarcode, setIsScanningBarcode] = useState(false);`.
3.  Update the `handleBarcode` function to manage this state and provide improved messaging:
    ```tsx
    async function handleBarcode(barcode: string) {
      if (!barcode.trim() || isScanningBarcode) return;
      
      setIsScanningBarcode(true);
      setScanMessage(`Searching for ${barcode}...`);
      
      try {
        const match = await findByBarcode(barcode);
        if (!match) {
          setQuery(barcode);
          setScanMessage(`Barcode ${barcode} not found in catalog or Rebrickable. Search is filled so you can add it manually.`);
          return;
        }

        setScannerOpen(false);
        setScanMessage(`Found ${match.name}`);
        addItem(match, 'collection');
      } catch (error) {
        setScanMessage(`Error searching for barcode ${barcode}. Please try again.`);
      } finally {
        setIsScanningBarcode(false);
      }
    }
    ```
4.  Run: `harness validate`
5.  Commit: `feat(ui): add scanning state and improved handleBarcode logic`

### Task 2: Enhance BarcodeScanner with loading state

**Depends on:** Task 1 | **Files:** `apps/web/src/api/main.tsx`

1.  Update the `BarcodeScanner` component signature to accept `isScanning: boolean`.
2.  Update the `BarcodeScanner` JSX to show a spinner and disable inputs when `isScanning` is true:
    - Add `processing` class to `scanner-frame` if `isScanning` is true.
    - Replace the `<Camera size={34} />` with `{isScanning ? <RefreshCw size={34} className="spinning" /> : <Camera size={34} />}`.
    - Update the message paragraph: `<p>{isScanning ? 'Looking up item details...' : message}</p>`.
    - Disable the manual input and search button when `isScanning` is true.
3.  Update the `App` component's call to `BarcodeScanner` to pass `isScanning={isScanningBarcode}`.
4.  Run: `harness validate`
5.  Commit: `feat(ui): update BarcodeScanner with loading indicators`

### Task 3: Add CSS for scanning feedback

**Depends on:** none | **Files:** `apps/web/src/api/styles.css`

1.  Open `apps/web/src/api/styles.css`.
2.  Add styles to dim the video feed and highlight the spinner when processing:
    ```css
    .scanner-frame.processing video {
      opacity: 0.4;
    }

    .scanner-frame.processing svg {
      color: #f4c534;
    }
    ```
3.  Run: `harness validate`
4.  Commit: `style(ui): add scanning processing styles`

### Task 4: Finalize message clarity and error handling

**Depends on:** Task 1, 2 | **Files:** `apps/web/src/api/main.tsx`

1.  Verify `handleBarcode` catch block and final messages match the spec requirements for clear feedback.
2.  Ensure that `setScannerOpen(false)` is only called on successful match, allowing the user to retry or enter a different code if not found.
3.  Run: `harness validate`
4.  Commit: `fix(ui): ensure accurate barcode lookup messaging`

### Task 5: Integration & Verification

**Depends on:** Task 1, 2, 3, 4 | **Category:** integration

1.  Run `harness validate` to ensure project health.
2.  [checkpoint:human-verify] Start the dev server and verify:
    - Scanning a known barcode (e.g., `5702016913484`) shows "Looking up item details..." then closes and adds the item.
    - Entering a fake barcode shows the "not found" message.
    - The "Search" button in the modal is disabled during lookup.
3.  Commit: `docs(barcode): complete Phase 2 UI feedback and verification`

## Uncertainties
- [DEFERRABLE] Browser support for `BarcodeDetector` API varies; the existing `canUseBarcodeDetector()` check handles fallback to manual entry.
- [ASSUMPTION] The Rebrickable API responds within a reasonable timeout (~2-5s) to avoid perceived UI freeze.

## Integration Tier: medium
This plan involves updating the web UI to handle new async domain logic, involving state management, CSS updates, and user feedback cycles.
