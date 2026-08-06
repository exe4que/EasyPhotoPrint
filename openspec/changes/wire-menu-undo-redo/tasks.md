## 1. Main process — custom Edit menu

- [x] 1.1 In `electron/main/menu.ts`, define `UNDO_CHANNEL = 'menu:undo'` and `REDO_CHANNEL = 'menu:redo'` alongside the existing channel constants.
- [x] 1.2 Replace `{ role: 'editMenu' }` with a custom `Edit` submenu: `Undo` (accelerator `CmdOrCtrl+Z`, `click: () => sendToFocusedWindow(UNDO_CHANNEL)`), `Redo` (accelerator `CmdOrCtrl+Shift+Z`, `click: () => sendToFocusedWindow(REDO_CHANNEL)`), a separator, then `{ role: 'cut' }`, `{ role: 'copy' }`, `{ role: 'paste' }`, `{ role: 'selectAll' }`.

## 2. Preload — expose the new menu events

- [x] 2.1 In `electron/preload/index.ts`, add `onUndo` and `onRedo` to `eppAPI.menu`, each implemented with the existing `onMenuEvent('menu:undo'/'menu:redo', callback)` wrapper.

## 3. Renderer — subscribe and remove the toolbar buttons

- [x] 3.1 In `src/App.tsx`, add two `useEffect` subscriptions (mirroring `onNewProject`/`onSaveProject`) that call `getEppApi().menu.onUndo(undo)` / `onRedo(redo)`, using the `undo`/`redo` functions already returned by `useUndoRedo()`.
- [x] 3.2 Remove the "Undo" and "Redo" `<button>` elements from the header in `src/App.tsx`.

## 4. Verification

- [x] 4.1 Run the app, make a document change (e.g. resize a divider), and confirm `Edit > Undo` reverts it and `Edit > Redo` reapplies it.
- [x] 4.2 Confirm the `CmdOrCtrl+Z` / `CmdOrCtrl+Shift+Z` accelerators work the same way without opening the menu.
- [x] 4.3 Confirm no standalone Undo/Redo buttons remain in the app header.
- [x] 4.4 Run `openspec validate --strict` for this change and confirm it passes.
