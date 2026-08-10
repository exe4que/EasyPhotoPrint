## 1. Menu changes (Main process)

- [x] 1.1 In `electron/main/menu.ts`, remove `{ role: 'cut' }`, `{ role: 'copy' }`, `{ role: 'paste' }`, `{ role: 'selectAll' }` from the `Edit` submenu.
- [x] 1.2 In `electron/main/menu.ts`, add two new channel constants (`SAVE_TEMPLATE_CHANNEL = 'menu:save-template'`, `SAVE_TEMPLATE_AS_CHANNEL = 'menu:save-template-as'`) and two new `Edit` submenu items — `Save Template` and `Save Template As...` — each calling `sendToFocusedWindow(...)` with its channel, placed after the existing `Undo`/`Redo`/separator, no accelerators.

## 2. IPC plumbing (preload + renderer types)

- [x] 2.1 In `electron/preload/index.ts`, add `onSaveTemplate`/`onSaveTemplateAs` to `eppAPI.menu`, each wrapping `onMenuEvent('menu:save-template', callback)` / `onMenuEvent('menu:save-template-as', callback)`, matching the existing `onUndo`/`onRedo` pattern.
- [x] 2.2 In `src/lib/ipc-client.ts`, add `onSaveTemplate`/`onSaveTemplateAs` to `EppAPI['menu']`'s type, matching `onUndo`/`onRedo`.

## 3. Save Template: drop the sidebar panel, wire to the menu

- [x] 3.1 In `src/components/templates/SaveTemplateDialog.tsx`, remove the `CollapsiblePanel` wrapper and its "Save"/"Save as…" buttons. Keep `confirmMode`/`saveAsName`/`errorMessage`/`isSaving` state and both `ConfirmDialog`s unchanged. Add two `useEffect`s subscribing to `getEppApi().menu.onSaveTemplate(...)` and `.onSaveTemplateAs(...)`: `onSaveTemplateAs` sets `confirmMode` to `'saveAs'` (and resets `saveAsName`/`errorMessage`, matching the old button's behavior); `onSaveTemplate` sets `confirmMode` to `'save'` when `linkedTemplate` exists, otherwise falls back to the same `'saveAs'` setup — per the agreed "Save Template with nothing linked behaves like Save Template As" decision.
- [x] 3.2 In `src/App.tsx`, remove `<SaveTemplateDialog templates={...} onSaved={...} />` from the left `<aside>`'s panel list, and mount it unconditionally elsewhere in the component (alongside the other menu-triggered pieces) with the same `templates={templateLibrary.templates}` / `onSaved={templateLibrary.reload}` props. Mounted as a sibling of the three `ConfirmDialog`s, outside the `viewMode` ternary — same reasoning as those: the Edit menu stays live regardless of which screen (editor/preview) is showing.

## 4. Move the Layout Tree panel

- [x] 4.1 In `src/App.tsx`, remove `{layoutMode === 'nested' ? <LayoutTreePanel /> : null}` from the end of the left `<aside>`'s children.
- [x] 4.2 In `src/App.tsx`, add `{layoutMode === 'nested' ? <LayoutTreePanel /> : null}` to the end of the right `<aside>`'s children, after `<PropertiesPanel />`.

## 5. Verification

- [x] 5.1 `npm run typecheck` and `npm run test` pass. Clean typecheck; 148/148 tests pass.
- [x] 5.2 Manually exercise the app (or a scripted Electron/Playwright pass, per this repo's established E2E verification recipe, using `app.evaluate` to inspect `Menu.getApplicationMenu()` and `.click()` real menu items end-to-end): confirm the `Edit` menu no longer has `Cut`/`Copy`/`Paste`/`Select All` and does have `Save Template`/`Save Template As...`; confirm typing/pasting into the template-name input still works via OS keyboard shortcuts; trigger `Edit > Save Template As...` and confirm the name-prompt dialog opens and saves a new template; link a page to a template, trigger `Edit > Save Template`, confirm it overwrites (with confirmation) instead of prompting for a name; trigger `Edit > Save Template` on a page with no linked template, confirm it prompts for a name instead of doing nothing; confirm no "Save template" panel appears in either sidebar; switch to Nested mode and confirm the Layout Tree panel appears in the right sidebar below Properties, not the left sidebar; switch to Simple mode and confirm the Layout Tree panel is gone from both sidebars. Verified end-to-end under `xvfb` with Playwright's `_electron`, driving the real native menu (`Menu.getApplicationMenu()` inspection + real `.click()` calls): every scenario above confirmed exactly as specified, including the linked/unlinked `Save Template` branching and the right-sidebar "Slot properties" → "Layout tree" heading order in Nested mode. Test template file cleaned up from `~/.config/easy-photo-print/templates/` after the run.
- [x] 5.3 `openspec validate --strict` for this change passes. Confirmed.
