## Why

The toolbar's "Undo"/"Redo" buttons are the *only* working entry point into the document's undo/redo history today. The application menu's `Edit` group uses Electron's default `editMenu` role, whose Undo/Redo items call `webContents.undo()/redo()` — Chromium's text-field edit undo, not `useEPPStore.temporal`. Nothing in the renderer listens for a menu-driven undo/redo event, and there is no keyboard shortcut wired to the document history either. We want a single, correct entry point (the app menu, with real keyboard shortcuts) instead of a toolbar button duplicating menu real estate, so removing the buttons first requires making the menu actually work.

## What Changes

- Replace `Edit`'s default `editMenu` role with a custom submenu that keeps the standard Cut/Copy/Paste/Select All roles but adds explicit `Undo` (`CmdOrCtrl+Z`) and `Redo` (`CmdOrCtrl+Shift+Z`) items that notify the focused renderer window instead of invoking Chromium's built-in text-edit undo.
- Add `menu:undo` / `menu:redo` IPC channels (Main → renderer), following the existing payload-free `menu:*` pattern already used for `menu:new-project` / `menu:save-project`.
- Expose `window.eppAPI.menu.onUndo(callback)` / `onRedo(callback)` from the preload script, mirroring `onNewProject`/`onSaveProject`.
- Subscribe to those events in the renderer and invoke `useEPPStore.temporal.getState().undo()` / `.redo()`.
- **BREAKING (UI only, not persisted data):** Remove the standalone "Undo"/"Redo" buttons from the app header (`src/App.tsx`). Undo/redo becomes reachable only via `Edit > Undo`/`Edit > Redo` or their keyboard accelerators.
- The `Undo`/`Redo` menu items stay always-enabled (no reactive disabling based on history state) — matches the current buttons' behavior exactly; see design.md - Decisions.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `electron-shell`: `Edit` menu changes from the default `editMenu` role to a custom submenu; `Undo`/`Redo` items become explicitly specified (accelerators, IPC channel) instead of implied by the role. `window.eppAPI.menu` gains `onUndo`/`onRedo`.
- `undo-redo`: the "Undo and Redo Controls" requirement is satisfied by application-menu items + keyboard accelerators instead of dedicated toolbar buttons; the delta specifies where the control now lives.

## Impact

- `electron/main/menu.ts` — custom `Edit` submenu, new accelerators.
- `electron/preload/index.ts` — new `menu.onUndo`/`onRedo` bridge methods.
- `src/App.tsx` — remove Undo/Redo buttons, subscribe to the two new menu events.
- `src/hooks/useUndoRedo.ts` — likely unchanged (still wraps `useEPPStore.temporal`), reused by the new subscription.
- No project file format or persisted-state changes; this is UI/IPC wiring only.
