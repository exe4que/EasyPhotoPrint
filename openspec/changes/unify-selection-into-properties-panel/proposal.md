## Why

Selection is currently split into two unrelated concepts that don't know about each other: `ui.selectedElementIds` (a layout node on the canvas or layout tree) and a separate local `selectedImageAssetId` in `App.tsx` (an Image Library thumbnail). `SelectionPanel` shows both side by side regardless of which one is actually relevant, and `PropertiesPanel` only lets you change a node's type in one narrow case (the Simple-mode root). This adds panel clutter and an inconsistent editing surface for no real benefit — nothing depends on both being selected simultaneously. Unifying "what's selected" into one mutually-exclusive concept, and folding that concept's display into `PropertiesPanel`, simplifies the mental model and removes a whole panel.

## What Changes

- **BREAKING (internal state shape, not user-facing data)**: Replace `ui.selectedElementIds: string[]` and `App.tsx`'s local `selectedImageAssetId` with a single discriminated selection field in the store, so a layout node and a library image can never both be "selected" at once — selecting one replaces whatever was selected before.
- Delete `SelectionPanel` entirely. `PropertiesPanel` absorbs its "selected library image" display (filename, pixel dimensions, clear action) as a new branch, shown whenever the selection is an image rather than a node.
- `PropertiesPanel` falls back to showing the active page's root node's properties whenever nothing is selected, in every layout mode and for every root node type — replacing today's narrower fallback (Simple mode always; Nested mode only when the root happens to be a `grid`) and its "select a node" placeholder for the other cases.
- `PropertiesPanel` gains a type-changing control for whatever node is currently selected (or the root, when nothing is), generalizing what's today only available for the Simple-mode root (and, separately, from `LayoutTreePanel`'s per-row selector in Nested mode, which is unaffected and stays). This uses the same retyping logic already used for non-root nodes, so switching a Simple-mode root to `imageSlot` no longer auto-preserves the tree's first assigned image — an intentional simplification, not an oversight.
- Remove `setSimpleRootType` and its Simple-mode-only helpers (`setSimpleRootTypeForPage`, `firstAssignedImageAssetId`) once `PropertiesPanel`'s root-type control moves onto the general retyping action — they become dead code with no remaining caller.

## Capabilities

### New Capabilities
- `properties-panel`: the single Properties panel as the one place selection details and node-type editing live — app-wide single selection (a node or a library image, never both), what the panel shows for each selection state (including the universal root fallback), and the ability to change any selected node's type from the panel.

### Modified Capabilities
(none — nothing existing documents today's Selection/Properties panel behavior; see Impact)

## Impact

- `src/store/uiSlice.ts`: `selectedElementIds: string[]` replaced by a single discriminated selection field; `setSelectedElementIds`/`clearSelection` and `computeDefaultSelection`/`computeActivePageUi` updated accordingly.
- `src/App.tsx`: local `selectedImageAssetId` state removed; `SelectionPanel` no longer rendered/imported.
- `src/components/panels/SelectionPanel.tsx`: deleted.
- `src/components/panels/PropertiesPanel.tsx`: gains the image-selection branch, the universal root fallback, and the generalized type selector.
- `src/components/panels/ImageLibraryPanel.tsx`, `src/components/panels/LayoutTreePanel.tsx`, `src/components/canvas/PageStage.tsx`, `src/components/canvas/FreeformElement.tsx`: migrated onto the new unified selection field (same selection behavior for nodes/freeform elements, image-card selection now reads/writes the store instead of local `App.tsx` state).
- `src/store/documentSlice.ts`: `setSimpleRootType`, `setSimpleRootTypeForPage`, `firstAssignedImageAssetId` removed; their existing unit tests in `src/store/documentSlice.test.ts` removed with them. `retypeLayoutNode`/`retypeNodeById`, `normalizeRootForSimpleMode`, and `normalizePageForSimpleMode` are unaffected and keep their current callers (the Simple/Nested mode toggle still normalizes through `normalizePageForSimpleMode`, unrelated to this change).
- No IPC, persistence, or template-schema changes — this is confined to in-app UI state and the two affected panels.
