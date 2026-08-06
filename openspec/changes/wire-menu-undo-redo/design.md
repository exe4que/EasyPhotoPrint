## Context

See `proposal.md` - Why. Today `Edit` uses Electron's default `editMenu` role, whose Undo/Redo call `webContents.undo()/redo()` (Chromium's text-field edit undo) — never `useEPPStore.temporal`. The only working entry point is the toolbar's Undo/Redo buttons (`src/App.tsx`), which call `useEPPStore.temporal.getState().undo()/redo()` directly since they live in the renderer already.

Existing precedent for Main → renderer round-trips already exists for `menu:new-project`, `menu:open-project`, `menu:save-project`, `menu:save-project-as` (`electron/main/menu.ts`, `electron/preload/index.ts`, `src/App.tsx`). `menu:undo`/`menu:redo` follow the exact same shape.

## Goals / Non-Goals

**Goals:**
- Make `Edit > Undo` / `Edit > Redo` (and their accelerators) actually invoke the document's undo/redo history.
- Remove the toolbar buttons once the menu path works, per `undo-redo` spec's updated requirement.

**Non-Goals:**
- Reactive enable/disable of the `Undo`/`Redo` menu items based on whether history is empty. Electron `MenuItem`s are static once `Menu.setApplicationMenu` runs; making them reactive would require the renderer to push history-state changes back to Main on every store mutation to rebuild the menu, which is disproportionate to this change's scope. The current toolbar buttons already don't disable themselves when history is empty, so this preserves existing behavior exactly — no regression, no new feature bundled in.
- Any change to the temporal store, its scoping, or gesture-batching behavior (drag/rotate/etc.) — untouched by this change.

## Decisions

- **Custom `Edit` submenu instead of the `editMenu` role.** The default role wires Undo/Redo to `webContents.undo()/redo()`, which can't be redirected to a renderer-side callback — Electron does not let you keep a role's built-in items but override just one. We rebuild `Edit` explicitly: `Undo` and `Redo` as custom `click` handlers (mirroring the `File` menu's `sendToFocusedWindow` pattern), followed by a separator, then the standard `cut`/`copy`/`paste`/`selectAll` roles (unchanged, still native — this change only touches Undo/Redo).
- **Accelerators: `CmdOrCtrl+Z` / `CmdOrCtrl+Shift+Z` on both platforms.** Windows conventionally uses `Ctrl+Y` for Redo, but `Ctrl+Shift+Z` is also widely understood (Chrome, VS Code, Figma) and keeps Main-process logic and user-facing docs simple with one accelerator pair instead of per-platform branching. Consistent with how the app already treats `CmdOrCtrl+*` uniformly elsewhere in `menu.ts`.
- **IPC shape mirrors `menu:new-project` exactly**: payload-free event, `sendToFocusedWindow(channel)` in Main, `onMenuEvent(channel, callback)` wrapper in preload, a `useEffect` subscription in `App.tsx`. No new abstraction introduced — this is the fourth/fifth instance of an established pattern, not a new one.
- **`useUndoRedo()` hook is reused as-is.** `App.tsx` already calls `useUndoRedo()` for the button handlers; the new `useEffect` subscriptions call the same `undo`/`redo` functions it returns, so the hook itself needs no changes.

## Risks / Trade-offs

- [Menu items stay enabled even with empty history] → Mitigated by matching current (button) behavior exactly; zundo's `undo()`/`redo()` are no-ops on empty history, so no error surfaces. Explicitly a non-goal above, not an oversight.
- [Removing the toolbar buttons is a discoverability regression for users who don't know menu shortcuts] → Accepted per explicit user request; the app menu is the documented, canonical control per the updated `undo-redo` spec.
