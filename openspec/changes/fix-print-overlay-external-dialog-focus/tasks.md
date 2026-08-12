## 1. Fallback completion signal for `printPdfFile`

- [x] 1.1 In `electron/main/print-render/pdfPrintWindow.ts`, register an `app.on('browser-window-focus')` listener right before/around the `webContents.print(...)` call, scoped to that single call.
- [x] 1.2 On focus regained, start a short grace-period timer (~1s); if the real `print()` callback fires first, clear the timer and remove the focus listener as today.
- [x] 1.3 If the grace period elapses without the real callback having fired, force-resolve the promise (no error), matching the existing `failureReason === 'cancelled'` branch's behavior, and remove the focus listener.
- [x] 1.4 Ensure the focus listener and timer are always cleaned up on whichever path settles the promise (real callback, fallback, or an actual error) so nothing leaks or double-fires across subsequent print jobs.

## 2. Verification

- [x] 2.1 Manually reproduce on this Linux dev box: trigger Print, close the native print dialog in a way that previously left the overlay stuck, and confirm the overlay now dismisses within the grace period. Verified via the repo's real-Electron-under-Xvfb harness (Playwright `_electron.launch`): `webContents.print`'s prototype was stubbed to never invoke its callback (reproducing the Linux hang), then `browser-window-focus` was emitted on `app` to simulate focus returning after the native dialog closes. The overlay stayed visible through the ~1s grace period, then dismissed (1747ms total) with no error surfaced.
- [x] 2.2 Confirm the normal path is unaffected: printing to completion and explicitly cancelling via the dialog's own Cancel control still behave exactly as before (no error surfaced, overlay dismisses immediately on the real callback, not delayed by the grace period). Verified in the same harness: a stubbed `success: true` callback and a stubbed `success: false, failureReason: 'cancelled'` callback each dismissed the overlay in well under 1s (247ms and 105ms respectively), unaffected by the new fallback path.
- [x] 2.3 Run the project's existing test/typecheck/lint suite for the touched file. `npm run typecheck` and `npm run test` (189 tests, 25 files) both pass; no lint script exists in this repo.
