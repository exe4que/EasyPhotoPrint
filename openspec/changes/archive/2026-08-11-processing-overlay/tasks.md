## 1. Shared overlay state and component

- [x] 1.1 Add a `processingOverlay: { visible: boolean }` slice of state plus `showProcessingOverlay()`/`hideProcessingOverlay()` actions to `src/store/uiSlice.ts`
- [x] 1.2 Create `ProcessingOverlay` component under `src/components/ui/` (e.g. `ProcessingOverlay.tsx`): full-viewport fixed backdrop, high z-index, indeterminate spinner, captures all pointer events on its backdrop
- [x] 1.3 Mount `ProcessingOverlay` once near the app root, reading `visible` from the store
- [x] 1.4 Guard existing global keyboard-shortcut handling (e.g. preview's Escape-to-exit) to no-op while `processingOverlay.visible` is true

## 2. Wire the Image Library ingest flow

- [x] 2.1 In `ImageLibraryPanel.tsx`'s `handleOpenImages`, call `showProcessingOverlay()` before `openImagesFromDialog()` and `hideProcessingOverlay()` in a `finally` block

## 3. Wire Export PDF / Print

- [x] 3.1 In `PreviewScreen.tsx`'s `handleExportPdf`, call `showProcessingOverlay()` before `exportPdf()` and `hideProcessingOverlay()` in a `finally` block
- [x] 3.2 In `PreviewScreen.tsx`'s `handlePrint`, call `showProcessingOverlay()` before `printDocument()` and `hideProcessingOverlay()` in a `finally` block
- [x] 3.3 Confirm the existing per-button `exportState`/`printState` busy labels ("Exporting…"/"Printing…") still render correctly underneath the overlay, or simplify them if the overlay now makes them redundant

## 4. Verification

- [x] 4.1 Manually verify: adding images shows the overlay and blocks the rest of the app until the images appear in the library
- [x] 4.2 Manually verify: Export PDF and Print each show the overlay for their duration and it clears on success, on error, and on cancelling the native dialog
- [x] 4.3 Manually verify: while the overlay is shown during export/print, page navigation, the exit-preview control, and the other action button are all inert
- [x] 4.4 Run `openspec validate --strict --all`
