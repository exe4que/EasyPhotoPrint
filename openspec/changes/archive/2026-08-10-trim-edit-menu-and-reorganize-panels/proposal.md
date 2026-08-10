## Why

The `Edit` menu currently exposes browser-native `Cut`/`Copy`/`Paste`/`Select All` roles that don't apply to anything in this app (there's no text-editing or multi-select surface they'd act on) — dead menu items that only add noise. Separately, the "Save template" controls live as their own always-present sidebar panel even though they're an infrequent action better suited to a menu command, and the Layout Tree panel's left-sidebar position (grouped with document/page-setup/template controls) puts it far from the Properties panel it's most often used alongside when editing a Nested-mode tree.

## What Changes

- **BREAKING (user-facing menu structure)**: Remove the `Cut`, `Copy`, `Paste`, and `Select All` roles from the `Edit` menu.
- Remove the "Save template" panel from the left sidebar. Add `Save Template` and `Save Template As...` items to the `Edit` menu, round-tripping through the renderer the same way `File > Save`/`Save As...` and `Edit > Undo`/`Redo` already do (Main sends a payload-free event, the renderer does the actual work and shows its own confirmation/name-entry dialogs). `Edit > Save Template` behaves like `Save Template As...` when the active page isn't linked to a template yet (no existing dedicated behavior to fall back to, since the sidebar panel simply hid the "Save" button in that case).
- Move the Layout Tree panel (still Nested-mode-only) from the left sidebar to the right sidebar, below the Properties panel.

## Capabilities

### Modified Capabilities
- `electron-shell`: the "Trimmed application menu" requirement's `Edit` menu composition changes (drops `Cut`/`Copy`/`Paste`/`Select All`, gains `Save Template`/`Save Template As...`), and a new requirement documents the latter's Main↔Renderer round-trip, mirroring the existing `Edit > Undo and Redo Round-Trip Through the Renderer` requirement.

### New Capabilities
- `editor-layout`: which editor panels exist and where they live in the app shell, independent of what each panel's own content does. Covers Save Template no longer having a standalone panel, and the Layout Tree panel's position relative to Properties.

## Impact

- `electron/main/menu.ts`: `Edit` submenu template updated; two new menu-event channels (`menu:save-template`, `menu:save-template-as`) sent via the existing `sendToFocusedWindow` helper.
- `electron/preload/index.ts`, `src/lib/ipc-client.ts`: `menu.onSaveTemplate`/`menu.onSaveTemplateAs` added, mirroring `onSaveProject`/`onSaveProjectAs`.
- `src/components/templates/SaveTemplateDialog.tsx`: loses its `CollapsiblePanel`/trigger-button UI; keeps its `ConfirmDialog`-based save/save-as flow, now opened by the two new menu-event subscriptions instead of button clicks.
- `src/App.tsx`: no longer renders the Save Template panel inline in the left sidebar; subscribes to the two new menu events (same `useEffect` pattern as the existing menu subscriptions); moves `<LayoutTreePanel />` from the left `<aside>` to the right `<aside>`, below `<PropertiesPanel />`.
- No IPC handler changes in `electron/main/ipc/templates.handlers.ts` — saving a template still goes through the existing `templates:save` channel; only how the save flow is *triggered* changes.
