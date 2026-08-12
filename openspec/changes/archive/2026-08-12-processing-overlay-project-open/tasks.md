## 1. Overlay on project open

- [x] 1.1 In `src/App.tsx`, wrap the `openProject()` call inside the open-project `ConfirmDialog`'s `onConfirm` with `showProcessingOverlay()` before the call and `hideProcessingOverlay()` in a `finally` once it settles (success, cancellation, or failure), matching the pattern in `src/components/panels/ImageLibraryPanel.tsx`.
- [x] 1.2 Verify the missing-images dialog (`isMissingImagesDialogOpen`) still opens correctly after the overlay hides, when `openProject()` resolves `true` with missing assets.

## 2. Verification

- [x] 2.1 Run the app, trigger `File > Open...`, and confirm the blocking overlay is visible for the duration of the file read/extraction and disappears once the project (or an error, or a cancelled picker) resolves.
- [x] 2.2 Run existing tests (`npm test` or equivalent) to confirm no regression.
