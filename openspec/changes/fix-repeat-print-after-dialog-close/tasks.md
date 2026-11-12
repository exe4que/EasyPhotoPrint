## 1. Single-flight print

- [x] 1.1 In `electron/main/print-render/pdfPrintWindow.ts`, track whether a `webContents.print()` request is still pending in Chromium (set before the call, cleared only in its callback), and expose a check for it.
- [x] 1.2 In `electron/main/ipc/print.handlers.ts`, refuse `print:document` before composing the PDF while a request is pending, with a message saying a print dialog is already open (possibly behind the app window).
- [x] 1.3 In `src/components/preview/PreviewScreen.tsx`, strip Electron's `Error invoking remote method '…': Error:` prefix from displayed action errors.

## 2. Cancellation reason

- [x] 2.1 Treat both `'cancelled'` and `'Print job canceled'` failure reasons as a non-error outcome.

## 3. Verification

- [x] 3.1 On the real desktop: Print → focus returns to the app with the dialog behind it → Print again shows the notice immediately and the button returns to "Print"; after closing the hidden dialog, Print opens the dialog again. Verified on the user's KDE/XWayland desktop (real Electron via Playwright): with the dialog stacked behind the app window, a second Print showed the notice within ~1s, opened no new job, and left the button on "Print"; after closing that dialog, Print opened it again.
- [x] 3.2 On the real desktop: repeated Print → close-with-X cycles open the dialog each time and show no error. Verified in the same run (two cycles, closed via WM_DELETE_WINDOW like the title-bar X).
- [x] 3.3 `npm run typecheck` and `npm run test` pass (26 files, 226 tests).
