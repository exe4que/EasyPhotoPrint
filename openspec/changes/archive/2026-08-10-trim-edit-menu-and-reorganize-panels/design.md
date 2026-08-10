## Context

`electron/main/menu.ts`'s `buildApplicationMenu()` builds the `Edit` submenu as `Undo`, `Redo`, a separator, then the browser-native `{ role: 'cut' }`, `{ role: 'copy' }`, `{ role: 'paste' }`, `{ role: 'selectAll' }` items. Every other menu command in this app (`New`, `Open...`, `Save`, `Save As...`, `Undo`, `Redo`) follows the same round-trip shape: Main sends a payload-free event to the focused window via `sendToFocusedWindow(CHANNEL)`, the renderer subscribes once in `App.tsx` via a `useEffect` calling `getEppApi().menu.onXxx(handler)`, and the renderer does all the actual state work. Preload (`electron/preload/index.ts`) exposes each subscription via a shared `onMenuEvent(channel, callback)` helper; `src/lib/ipc-client.ts` types the resulting `EppAPI.menu` surface.

`src/components/templates/SaveTemplateDialog.tsx` currently combines two things in one component: the sidebar-visible trigger UI (a `CollapsiblePanel` titled "Save template" with "Save"/"Save as…" buttons, "Save" only shown when `activePage.templateRef` resolves to a known template) and the actual save flow (two `ConfirmDialog`s — an overwrite confirmation, and a name-entry prompt — driven by local `confirmMode` state). `App.tsx` renders it in the left `<aside>`, passing down `templates`/`onSaved` from its own `useTemplateLibrary()` hook.

`src/components/panels/LayoutTreePanel.tsx` is rendered conditionally (`layoutMode === 'nested'`) at the bottom of the left `<aside>` today. The right `<aside>` currently holds only `<PropertiesPanel />` (since the `unify-selection-into-properties-panel` change removed `SelectionPanel`).

## Goals / Non-Goals

**Goals:**
- Menu-driven Save Template that fits the exact same round-trip shape every other menu command already uses — no new architectural pattern.
- Remove the trigger UI from `SaveTemplateDialog` without disturbing its actual save/save-as/overwrite logic, which is unrelated to *how* it's triggered.
- Move `LayoutTreePanel` by relocating its JSX in `App.tsx` — no changes to the component itself.

**Non-Goals:**
- Not changing anything about how a template is actually persisted (`templates:save` IPC channel, `electron/main/ipc/templates.handlers.ts`) — only how the save flow is triggered in the renderer.
- Not adding accelerators to the new `Save Template`/`Save Template As...` menu items — none were requested, and picking one risks colliding with an existing shortcut for no clear benefit.
- Not making `Edit > Save Template` conditionally disabled based on whether the active page has a linked template — Electron's menu is built once at startup (`buildApplicationMenu()` is not re-invoked on state changes, matching every other menu item's static-enabled precedent); the fallback-to-Save-As behavior (decided with the user) avoids needing dynamic menu state entirely.

## Decisions

### `Save Template`/`Save Template As...` follow the exact `menu:undo`/`menu:redo` round-trip shape
Two new channels, `menu:save-template` and `menu:save-template-as`, sent via the same `sendToFocusedWindow` helper already used for every other menu item. Preload gets `onSaveTemplate`/`onSaveTemplateAs` wrappers around the existing `onMenuEvent` helper; `EppAPI.menu` gets the matching type entries. No new IPC *handler* — these are events Main pushes to the renderer, not requests the renderer makes to Main (same shape as `onUndo`/`onRedo`, unlike `templates:save` which is a real `ipcMain.handle` the renderer already calls).

*Alternative considered*: give `Edit > Save Template` a payload (e.g. whether a template is linked) computed in Main. Rejected — Main has no access to the renderer's store (the same reason `menu:save-project`/`menu:undo` are payload-free), so it cannot know the active page's `templateRef` any more than it can know the document state; the renderer already has everything it needs to decide "overwrite vs. prompt for a name" itself.

### `SaveTemplateDialog` sheds its trigger UI, keeps its save flow, moves into `App.tsx`'s menu-subscription block
Delete the `CollapsiblePanel` wrapper and its two buttons from `SaveTemplateDialog.tsx`; keep the `confirmMode`/`saveAsName`/`errorMessage`/`isSaving` state and both `ConfirmDialog`s exactly as they are. Replace the two button `onClick`s with two `useEffect` subscriptions (`onSaveTemplate`, `onSaveTemplateAs`) that set `confirmMode` directly — `onSaveTemplateAs` always sets `'saveAs'`; `onSaveTemplate` sets `'save'` if `linkedTemplate` exists, else `'saveAs'` (the agreed fallback). The component keeps rendering only the two `ConfirmDialog`s (no visible trigger element at all) and keeps living in its own file — it's still a self-contained unit (state + both dialogs + both menu subscriptions), just triggered externally instead of by its own buttons. `App.tsx` keeps mounting it unconditionally (like the other confirm-dialog-owning pieces), just removes it from inside the left `<aside>`'s panel list and renders it wherever the other menu-triggered dialogs already live.

*Alternative considered*: move the save-flow logic into `App.tsx` directly, deleting `SaveTemplateDialog.tsx` entirely (matching how the New/Open/missing-images `ConfirmDialog`s already live inline in `App.tsx`). Rejected — `SaveTemplateDialog` has meaningfully more self-contained state and logic (two-mode confirm flow, name-input validation, error handling) than the other dialogs' simple open/confirm/cancel; keeping it as its own component avoids growing `App.tsx` with logic that has nothing to do with app-shell composition.

### `LayoutTreePanel` moves by relocating JSX, nothing else
In `App.tsx`, remove `{layoutMode === 'nested' ? <LayoutTreePanel /> : null}` from the end of the left `<aside>`'s children and add it to the end of the right `<aside>`'s children, after `<PropertiesPanel />`, unchanged. `LayoutTreePanel.tsx` itself needs no changes — it already reads everything it needs from the store, not from props passed by its position in the tree.

## Risks / Trade-offs

- [Risk] A user muscle-memories `Cmd/Ctrl+C`/`Cmd/Ctrl+V` expecting browser-native copy/paste inside a text input (e.g. the template-name field) — removing the `Cut`/`Copy`/`Paste` *menu roles* does not remove the browser's native in-`<input>` clipboard handling (that's independent of the Electron menu roles, which only affect menu-driven / accelerator-driven invocation when a native role is registered). → Mitigation: verify during manual testing that typing, selecting, and pasting into the template-name `<input>` still works via normal OS keyboard shortcuts after the roles are removed from the menu (it should, since text inputs get clipboard behavior from the OS/Chromium natively, not from Electron's `Menu` roles) — Electron's `role: 'paste'` etc. exist to make the *menu item* invoke that behavior, they aren't the sole source of it.
