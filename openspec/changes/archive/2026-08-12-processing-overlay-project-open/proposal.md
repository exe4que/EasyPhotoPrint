## Why

`File > Open...` reads a `.eppproj` archive off disk (native dialog, zip extraction, image re-thumbnailing, missing-image detection) with no visual feedback while it's in flight. Every other multi-step operation the app performs — adding images to the library, exporting to PDF, printing — already shows the blocking `ProcessingOverlay` spinner for its duration (see the `processing-overlay` capability). Opening a project is the same shape of operation (an async round-trip the user must wait out) but is the one gap left uncovered, so the app currently looks frozen or unresponsive for however long that archive takes to read and extract.

## What Changes

- Extend the `processing-overlay` capability's list of overlay-triggering operations to include "opening/loading a project via `File > Open`".
- Wrap the `openProject()` store call (invoked from `App.tsx`'s open-project confirmation flow) with `showProcessingOverlay()`/`hideProcessingOverlay()`, matching the existing pattern already used for image-library ingestion (`ImageLibraryPanel.tsx`) and for PDF export/print (`PreviewScreen.tsx`).
- The overlay must still resolve correctly on cancellation (user dismisses the native file picker) and on failure (invalid/unreadable file), per the capability's existing "Overlay Always Resolves" requirement — no new behavior needed there since `openProject()` already returns/throws in both cases; the overlay just needs to be tied to its lifetime.

## Capabilities

### Modified Capabilities
- `processing-overlay`: adds "opening/loading a project via `File > Open`" as a fourth operation that triggers the blocking overlay, alongside image-library ingestion, PDF export, and printing.

## Impact

- `src/App.tsx`: wrap the existing `openProject()` call (inside the open-project `ConfirmDialog`'s `onConfirm`) with `showProcessingOverlay()`/`hideProcessingOverlay()`.
- `openspec/specs/processing-overlay/spec.md`: gains a new scenario under "Blocking Overlay Shown During In-Flight Processing" for project loading.
- No IPC, store-shape, or Main-process changes — `openProject()`'s existing return/throw behavior on success/cancel/failure is unchanged; only the UI feedback around it changes.
