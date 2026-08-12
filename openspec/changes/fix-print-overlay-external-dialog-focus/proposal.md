## Why

Pressing "Print" shows the blocking processing overlay, but on Linux the overlay never gets dismissed if the user closes the native OS print dialog without Chromium's print pipeline reporting completion back — the app is left permanently stuck behind the spinner until it's force-quit. This already violates the `processing-overlay` capability's "Overlay Always Resolves" requirement and the `printing` capability's "Print Dialog Cancellation Has No Side Effect" requirement, both of which already document that dismissing the native print dialog must dismiss the overlay without error. This change is a bug fix to make the implementation actually satisfy that already-documented behavior — no requirement is changing.

## What Changes

- In `electron/main/print-render/pdfPrintWindow.ts`, the `Promise` wrapping `window.webContents.print(...)` (`pdfPrintWindow.ts:79-87`) has no fallback: if the OS/Chromium print pipeline never invokes the completion callback (a known unreliable path on Linux when the native GTK/CUPS dialog is dismissed), the promise hangs forever, so `ipcMain.handle('print:document', ...)` never returns, `await printDocument()` in `PreviewScreen.tsx` never returns, and the overlay's `finally { hideProcessingOverlay(); }` never runs.
- Add a fallback completion signal alongside the `print()` callback: treat the app regaining OS focus (`app.on('browser-window-focus')`) after the print dialog was opened, combined with a short grace period to let a genuine callback win first, as evidence the external dialog has closed. If the real callback still hasn't fired once that grace period elapses, force-settle the pending promise the same way an explicit `'cancelled'` result is already handled today (resolve without error), per the existing "Print Dialog Cancellation Has No Side Effect" requirement.
- No IPC contract, renderer-side overlay wiring, or store shape changes — `handlePrint`'s existing `try/finally` around `printDocument()` already does the right thing once the underlying promise actually settles.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none — `openspec/specs/processing-overlay/spec.md`'s "Overlay Always Resolves" requirement and `openspec/specs/printing/spec.md`'s "Print Dialog Cancellation Has No Side Effect" requirement already document the behavior this change restores; this is an implementation fix, not a requirement change. This change sets `skip_specs: true`.)

## Impact

- `electron/main/print-render/pdfPrintWindow.ts` — `printPdfFile`'s print-completion promise gains a focus-based fallback path.
- No renderer, IPC contract, or store changes.
- Affects the Electron desktop host only (the `printing` capability's native print flow); no effect on the Android shell's print path (`src/lib/android/printPlugin.ts`), which doesn't go through this window.
