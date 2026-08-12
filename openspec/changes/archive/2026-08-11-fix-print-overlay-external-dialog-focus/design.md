## Context

`printPdfFile` (`electron/main/print-render/pdfPrintWindow.ts:74-88`) opens a hidden `BrowserWindow` (`show: false`), loads the composed PDF into it, and calls `window.webContents.print({...}, callback)`. The returned `Promise` only ever settles from inside that `callback`. On Linux, the native print dialog is backed by GTK/CUPS outside Chromium's own control, and closing it (via its own window-manager close button, `Escape`, or certain flavors of "Cancel") does not reliably invoke Electron's completion callback at all — this is a platform limitation, not something fixable by changing how `print()` is called. When the callback never fires, the `Promise` in `pdfPrintWindow.ts` hangs forever, which hangs the `print:document` IPC call, which hangs `PreviewScreen.tsx`'s `await printDocument()`, which means its `finally { hideProcessingOverlay() }` never runs. See `proposal.md` - Why.

The `loadURL` call already has a `withTimeout` wrapper (`pdfPrintWindow.ts:43-53`); the `print()` call does not.

## Goals / Non-Goals

**Goals:**
- Guarantee the print-completion promise always settles, even when the OS/Chromium never invokes the `print()` callback, so the processing overlay never gets stuck open.
- Preserve today's behavior for the working case (callback fires normally) — no change to success/failure/cancellation semantics when the platform does report them.

**Non-Goals:**
- Fixing or working around the underlying Electron/Linux GTK-CUPS callback gap itself (out of our control — this is an app-level Chromium/OS integration issue, not a bug in this codebase).
- Reworking the hidden-print-window architecture (`show: false`, single reused `BrowserWindow`) — unrelated to this bug.
- Distinguishing "user actually printed" from "user cancelled" when the fallback path is what settles the promise — same as an explicit `'cancelled'` result today, the fallback resolves without error (per `printing`'s "Print Dialog Cancellation Has No Side Effect").

## Decisions

- **Fallback signal: `app.on('browser-window-focus')`, not a blind timeout on `print()`.** The user's own repro names the exact signal already available to us: focus returns to the app once the external dialog closes. A fixed timeout (e.g., "give up after 30s") would either fire too early for a user still filling out print options, or leave the app stuck for the full timeout duration on every genuine hang — neither matches "resolves as soon as the operation settles" from the `processing-overlay` spec. Focus-return is the same event the user is already relying on to notice the bug, so it's the most accurate proxy available for "the external dialog is gone."
- **Grace period after the focus event, not an immediate force-resolve.** When focus returns, the real `print()` callback (if the platform is going to fire it at all) typically arrives within the same tick or shortly after. Waiting a short delay (on the order of ~1s) after `browser-window-focus` before force-resolving lets the genuine callback win first when it does fire, so the fallback only ever kicks in for the actual hang case, not by racing a working callback.
- **The fallback resolves (not rejects) the promise**, mirroring the existing `failureReason === 'cancelled'` branch — from the app's perspective, "the dialog closed and we never heard why" is treated the same as an explicit cancellation: no error surfaced, state left unchanged, overlay dismissed. This matches `printing`'s "Print Dialog Cancellation Has No Side Effect" and `processing-overlay`'s "Overlay Always Resolves" requirements, both already documented.
- **Listener lifecycle is scoped to a single `printPdfFile` call.** The `browser-window-focus` listener is registered right before/around the `print()` call and unconditionally removed (via whichever path settles the promise first — real callback or fallback), so it never leaks across separate print jobs or fires spuriously for unrelated focus changes after the promise has already settled.

Alternatives considered:
- **Timeout on the whole `print()` call, same pattern as `withTimeout` on `loadURL`.** Rejected as the sole mechanism — see above; a fixed duration is either too eager or too slow, and doesn't track the actual event the user observed.
- **Polling `printWindow.isVisible()` / checking for the native dialog's existence.** Not viable — the native print dialog is an OS-level window outside Electron's `BrowserWindow` model; there's no API to observe it directly.
- **Do nothing and document it as a known Linux limitation.** Rejected — the whole point of the `processing-overlay` capability is that the overlay always resolves; leaving a known way to hang it permanently defeats that requirement's purpose, and the fix is tractable.

## Risks / Trade-offs

- [The focus-return heuristic can theoretically fire while the native dialog is still open, if the user alt-tabs back to the app window without closing the dialog first] → Accepted: the grace period reduces this to "briefly re-showing the app while a separate OS dialog is still up," not a corruption of app or document state (the "Print Dialog Cancellation Has No Side Effect" requirement is about state, not overlay timing), and it only matters if the real callback still hasn't arrived by the time the grace period elapses. A permanently stuck app is a strictly worse outcome than a rare early-dismissed overlay.
- [Grace period duration is a guess, not measured against real Linux print-dialog timing] → Acceptable for a first fix; tune later if real usage shows the fallback firing too eagerly or not eagerly enough. Not worth over-engineering into a configurable value for a single call site.
