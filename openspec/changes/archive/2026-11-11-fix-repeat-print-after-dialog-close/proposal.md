## Why

After pressing "Print", closing the native print dialog, and pressing "Print" again, the native print dialog sometimes never opens a second time and the "Print" button stays stuck on "Printing…".

Reproduced on the user's desktop (KDE Plasma, Wayland session, Electron 31 under XWayland), with both the dev build and the installed v1.0.0: the native GTK print dialog belongs to the hidden print window, not the main window, so when the app window regains focus while the dialog is open (a click on the app window, or the window manager handing it focus), the dialog drops *behind* the app window. The focus-return fallback added by `fix-print-overlay-external-dialog-focus` then reads the focus change as "the dialog closed" and resets the button, but Chromium still has that print request pending and will not open another dialog until it is answered. The next "Print" therefore opens nothing and hangs: in the old code the reused print window's `loadURL` blocks behind the pending request, and a fresh window's `print()` is silently held back. Neither reusing nor recreating the window, nor parenting it to the main window, keeps the dialog in front — measured.

A second defect surfaced while reproducing: when the user does cancel the dialog, Electron reports `failureReason: 'Print job canceled'` (measured on Electron 31 / Linux GTK), not `'cancelled'` as `printPdfFile` checks for, so every plain cancel showed a red "Printing failed: Print job canceled" error — contrary to the `printing` capability's "Print Dialog Cancellation Has No Side Effect" requirement.

## What Changes

- The main process tracks whether a print request is still pending in Chromium (its `print()` callback has not arrived yet), independently of whether the focus-return fallback already released the "Print" button.
- If "Print" is activated while a request is still pending, the `print:document` handler refuses immediately — before composing the PDF — with a notice telling the user a print dialog is already open (possibly behind the app window) and must be closed first. The renderer shows it in the existing inline error slot, and the button is not left busy.
- Both Electron cancellation reasons (`'cancelled'` and `'Print job canceled'`) are treated as a non-error outcome.
- The preview's action-error text drops Electron's `Error invoking remote method '…': Error:` prefix, so the notice (and other print/export errors) reads as a plain message.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `printing`: ADDED requirement "Print While a Print Dialog Is Still Open" — defines what activating "Print" does while a previous print dialog is still open, a case the existing requirements didn't cover (and which "Print Sends Every Page" can't satisfy, since Chromium won't open a second dialog).

## Impact

- `electron/main/print-render/pdfPrintWindow.ts` — pending-request tracking, cancellation reasons.
- `electron/main/ipc/print.handlers.ts` — refuse early while a request is pending.
- `src/components/preview/PreviewScreen.tsx` — strip Electron's IPC error prefix from the displayed message.
- Electron desktop host only; the Android print path is untouched.
