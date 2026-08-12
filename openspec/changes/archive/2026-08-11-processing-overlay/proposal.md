## Why

Adding images to the Image Library and exporting/printing from the preview screen are both asynchronous operations with no full-app feedback: the Image Library shows nothing at all while images decode, and the preview screen's "Export PDF"/"Print" controls only disable themselves while every other control (page navigation, exit preview, the other export/print button) stays interactive. A user can trigger overlapping actions or navigate away mid-operation, which risks confusing or inconsistent state. A blocking overlay (progress bar, or spinner if a determinate bar isn't feasible) during these three operations closes that gap.

## What Changes

- Add a reusable blocking overlay UI primitive: full-viewport, shows a progress bar (or spinner when progress can't be determined), and prevents all pointer/keyboard interaction with the rest of the app while visible.
- Wire the overlay into the Image Library's "Load images" flow (`openImagesFromDialog`): shown from the moment the dialog's images start decoding until they're merged into the pool.
- Wire the overlay into the preview screen's "Export PDF" and "Print" actions: shown for the duration of `exportPdf()` / `printDocument()`, replacing today's per-button-only busy state with an app-wide block. **BREAKING**: the `print-preview` capability's existing "Export and Print Controls Are Wired" requirement, which limits busy-state feedback to the activated control only, is superseded by this full-app block.
- No new IPC or backend work: the underlying async operations (image decode/merge, PDF export, print) are unchanged; only the UI feedback and interaction-blocking around them changes.

## Capabilities

### New Capabilities
- `processing-overlay`: defines the blocking overlay UI primitive (progress bar/spinner, full-app interaction block) and the contract for which in-flight operations must display it.

### Modified Capabilities
- `print-preview`: the "Export and Print Controls Are Wired" requirement's busy-state scenario changes from "only the activated control is disabled" to "the whole app is blocked by the processing overlay for the duration of the action."

## Impact

- `src/components/panels/ImageLibraryPanel.tsx` — show/hide the overlay around `handleOpenImages`.
- `src/store/imagePoolSlice.ts` — no behavior change to `openImagesFromDialog` itself; overlay is driven by its pending Promise.
- `src/components/preview/PreviewScreen.tsx` — replace/extend the local `exportState`/`printState` busy handling with the shared overlay.
- New UI primitive under `src/components/ui/` (e.g. `ProcessingOverlay.tsx`) plus the global busy state it reads from — likely a small addition to `src/store/uiSlice.ts`, the existing home for cross-cutting UI state.
- No changes to `electron/main/ipc/pdf.handlers.ts`, `electron/main/ipc/print.handlers.ts`, or the image-decoding pipeline.
