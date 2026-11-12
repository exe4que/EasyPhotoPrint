## Context

`printPdfFile` reuses one hidden `BrowserWindow` that hosts Chromium's PDF viewer and calls `webContents.print()` on it. The resulting GTK dialog is transient for that hidden window, not for the main window, so the window manager is free to stack the main window above it whenever the main window gets focus. The focus-return fallback (from `fix-print-overlay-external-dialog-focus`) then resolves our promise after 1s, although Chromium's request is still pending. In every measured run on the user's desktop the real `print()` callback *did* arrive as soon as the dialog was actually closed (`'Print job canceled'` on cancel), which suggests the hang the earlier fix addressed was this same hidden-dialog situation rather than a callback that never fires.

Measured while the earlier request was still pending, on KDE/XWayland:
- reused window: the next job's `loadURL` blocks; no dialog, button stuck.
- fresh window per job: `print()` is called, but no dialog opens; button stuck.
- fresh window with `parent: mainWindow`: same, and the dialog is still stacked below the main window.
- fresh *visible* 1×1 child window: a new dialog opens each time, but earlier dialogs pile up behind the app — rejected (fragile, unverified on Windows/macOS, user saw several dialogs at once).

## Goals / Non-Goals

**Goals:**
- A second "Print" while a dialog is still pending never hangs; it tells the user what's going on.
- A cancelled dialog never surfaces an error.

**Non-Goals:**
- Forcing the native dialog to stay above the app window (no reliable Electron/GTK mechanism found).
- Changing the focus-return fallback heuristic; it still releases the overlay/button.

## Decisions

- **Single-flight print, tracked by Chromium's callback, not by our promise.** A module-level flag is set right before `webContents.print()` and cleared only when its callback fires. The fallback still settles our promise (so the overlay never sticks), but the flag stays set until Chromium actually answers. The singleton print window is kept: once the callback has arrived, the window is clean and safe to reuse.
- **Refuse in the IPC handler before composing.** Composing a multi-page photo PDF is the expensive part; checking first makes the refusal instant. A dedicated error message tells the user the dialog may be behind the app window.
- **Cancellation reasons as an explicit set** (`'cancelled'`, `'Print job canceled'`) instead of a fuzzy match, so unexpected failure strings still surface as errors.
- **Strip Electron's `Error invoking remote method '<channel>': Error: ` prefix in the preview's error text**, so the notice reads as written.

## Risks / Trade-offs

- [If Chromium ever never delivers the callback for a closed dialog, printing stays blocked until restart] → Not observed in any run on the user's desktop (dev and installed builds, X-button close); the notice makes the state visible instead of a silent hang. Revisit with a reset path if it's ever reported.
- [The user has to find the hidden dialog themselves (Alt+Tab)] → Accepted; the notice says where to look.
