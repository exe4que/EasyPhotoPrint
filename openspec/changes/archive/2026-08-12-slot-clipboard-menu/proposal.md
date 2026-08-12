## Why

Power users building multi-page or repetitive layouts (e.g. a grid of identically-styled photo slots) currently have to re-set the scaling rule, rotation, padding, and image assignment by hand on every `imageSlot`, one at a time. There's no way to configure one slot the way you want and stamp that configuration onto others.

## What Changes

- Add a "⋮" (kebab) menu button to the Properties panel's "Slot properties" section, visible only when the selected/in-view node is an `imageSlot`.
- The menu offers four actions:
  - **Copy** — copies the slot's assigned image, scaling rule, rotation, and padding to an in-memory clipboard (renamed from the originally-requested "Copy slot" — shorter, and "slot" is redundant since the menu only ever appears on slots).
  - **Copy to siblings** — immediately applies the copied slot's image/scaling rule/rotation/padding to every other `imageSlot` sharing the same parent container, without requiring a separate Paste (renamed from "Copy to all siblings").
  - **Copy to page** — immediately applies the same properties to every `imageSlot` in the active page's layout tree, regardless of nesting (renamed from "Copy to all nodes in page").
  - **Paste** — applies the clipboard's copied properties to the currently selected slot. Disabled/inactive until a slot has been copied.
- "Copy to siblings" and "Copy to page" both copy from the currently selected slot as their source, then apply directly — they do not require calling "Copy" first, and they do not require a subsequent "Paste".
- All four actions integrate with the app's existing undo/redo history as a single undoable step per action.
- **BREAKING**: none — this is purely additive UI/behavior.

## Capabilities

### New Capabilities
- `slot-clipboard`: defines the clipboard state (what "copy" captures: image assignment, scaling rule, rotation, padding), and the copy/paste-to-siblings/paste-to-page behaviors, including their interaction with undo/redo and their scope (single page, in-memory, not persisted with the project).

### Modified Capabilities
- `properties-panel`: the "Slot properties" section gains a "⋮" menu, shown only for `imageSlot` selections/context nodes, exposing the `slot-clipboard` actions.

## Impact

- `src/components/panels/PropertiesPanel.tsx` — add the "⋮" menu UI to the `imageSlot` branch.
- `src/store/documentSlice.ts` (or a new store slice) — add clipboard state and the copy/apply-to-siblings/apply-to-page/paste actions, wired into the existing undo/redo mechanism.
- No changes to persisted project schema (`template-schema`) — the clipboard is transient, in-memory, app-session state, not saved with the document.
