## Context

Two independent, unrelated pieces of state currently represent "what's selected":

- `ui.selectedElementIds: string[]` (`src/store/uiSlice.ts`) — every one of its four readers (`PropertiesPanel`, `SelectionPanel`, `LayoutTreePanel`, `PageStage`) does `selectedElementIds[0] ?? null`; the array has never held more than one id. `computeDefaultSelection`/`computeActivePageUi` default it to the active page's root node id in Simple mode, empty it in Nested mode.
- `selectedImageAssetId: string | null` — plain `useState` local to `App.tsx`, threaded as props into `ImageLibraryPanel` and `SelectionPanel`. Not in the store.

`SelectionPanel` renders both, unconditionally, side by side. `PropertiesPanel` resolves a `contextNode` from `selectedElementIds[0]`, falling back to the page root only in Simple mode or when a Nested-mode root happens to be a `grid`; otherwise it shows a "select a node" placeholder. Its only type-changing control (`rootTypeSelector`, calling `setSimpleRootType`) is gated to `layoutMode === 'simple' && contextNode?.id === activePage.rootNode.id` — the Simple-mode root, and nothing else. `LayoutTreePanel` (Nested mode only) has its own per-row type `<select>` calling `retypeLayoutNode`, the only way today to retype anything else.

`setSimpleRootType` → `setSimpleRootTypeForPage` (`src/store/documentSlice.ts`) is a Simple-mode-only code path: it runs `normalizeRootForSimpleMode` first, and when converting to `imageSlot`, calls `firstAssignedImageAssetId` to find and re-assign the first image assignment found anywhere in the prior tree. `retypeLayoutNode` → `retypeNodeById` has no such preservation — converting a node with assigned children into an `imageSlot` drops those assignments (`filterAssignmentsForRootNode` only prunes to still-existing slot ids, it doesn't pick one to keep). `setSimpleRootType`'s only production call site is `PropertiesPanel`'s `rootTypeSelector`; `normalizeRootForSimpleMode` has a second, independent caller (`normalizePageForSimpleMode`, used by the Simple/Nested mode toggle) and stays regardless of this change.

## Goals / Non-Goals

**Goals:**
- One selection concept, app-wide, where a node and a library image can never both be selected — enforced by the shape of the state, not by convention.
- One panel (`PropertiesPanel`) for both selection details and node editing.
- A type-changing control available for any node in view, in Properties panel, in any layout mode.

**Non-Goals:**
- Not changing how grid/container properties themselves are edited (rows, columns, gap, padding, slot count) — those views carry over unchanged, just reached via the new selection field.
- Not changing `LayoutTreePanel`'s own per-row type selector or its behavior.
- Not introducing true multi-select — the discriminated field still models "at most one thing," just cleanly, replacing an array that was always used as if it were already that.
- Not preserving `setSimpleRootType`'s "keep the first assigned image" behavior when retyping a Simple-mode root to `imageSlot` — the general `retypeLayoutNode` path does not do this, and that's an accepted, intentional simplification (see proposal.md).

## Decisions

### A discriminated `ui.selection` field replaces `selectedElementIds` and `selectedImageAssetId`
```ts
export type Selection = { kind: 'node'; id: string } | { kind: 'image'; id: string } | null;
```
Lives in `UiState` (`src/store/uiSlice.ts`) alongside `activePageId`/`layoutMode`/`viewMode`, following the exact same pattern: plain `set()`-based setter, excluded from zundo's tracked history the same way the rest of `ui` already is (`store/index.ts`'s `partialize` only ever included `document`; nothing about this field changes that). A single `setSelection: (selection: Selection) => void` action replaces `setSelectedElementIds`; `clearSelection`'s existing Simple-mode-falls-back-to-root behavior is preserved as-is, just operating on the new field's shape (`clearSelection()` sets `selection` to `{ kind: 'node', id: rootId }` in Simple mode, `null` in Nested mode — same logic `computeDefaultSelection` already has, retargeted).

*Alternative considered*: keep two separately-nullable fields (`selectedNodeId`, `selectedImageAssetId`) and have each setter clear the other. Rejected per the explore-mode discussion with the user — this is exactly the "two fields that must be kept in sync by convention" shape that has already caused a real bug once this session (the zundo undo/redo history-pollution fix): a discriminated union makes the invalid state unrepresentable instead of merely disciplined-against.

*Alternative considered*: move `selectedImageAssetId` into the store as its own field, unrelated to `selectedElementIds`, without unifying them. Rejected — this satisfies "image selection lives in the store" but not "only one thing selected at a time," which is the actual requirement; two independent nullable fields in the store are no more mutually-exclusive than one in the store and one in `App.tsx`.

### Migrating existing call sites
- `PageStage.tsx`, `FreeformElement.tsx` (via its `onSelect` callback), `LayoutTreePanel.tsx`: every current `setSelectedElementIds([id])` becomes `setSelection({ kind: 'node', id })`; every `selectedElementIds[0] ?? null` read becomes `selection?.kind === 'node' ? selection.id : null`.
- `ImageLibraryPanel.tsx`: its `onSelectImageAssetId`/`selectedImageAssetId` props (currently threaded down from `App.tsx`'s local state) are replaced by reading/writing the store directly (`selection?.kind === 'image' ? selection.id : null`, `setSelection({ kind: 'image', id })` / `setSelection(null)` to toggle off) — `App.tsx` no longer owns or threads this state at all.
- `PropertiesPanel.tsx`: resolves `contextNode` from `selection?.kind === 'node' ? selection.id : null` (unchanged fallback-to-root logic otherwise, just broadened per the new "Properties Panel Falls Back to the Root Node" requirement — see below), and adds a new early branch for `selection?.kind === 'image'` rendering the migrated `SelectionPanel` image-details content.

### Universal root fallback replaces the Simple-mode/grid-only fallback
`PropertiesPanel`'s `contextNode` fallback becomes unconditional: `selectedNode ?? activePage.rootNode`, dropping the `layoutMode === 'simple' ? ... : rootNode.type === 'grid' ? ... : null` branching entirely. The "select a node" placeholder view (`!contextNode`) becomes unreachable and is removed — there's always a root node to fall back to. This directly resolves the inconsistency the explore-mode discussion surfaced (Nested mode with a non-`grid` root currently shows nothing useful with no selection).

### One retyping control, one action, replacing two
`PropertiesPanel`'s type-changing `<select>` moves out of the Simple-mode-root-only conditional and calls `retypeLayoutNode(activePage.id, contextNode.id, nextType)` for whatever `contextNode` currently is — root or not, Simple or Nested. `setSimpleRootType`, `setSimpleRootTypeForPage`, and `firstAssignedImageAssetId` (its only caller) are deleted from `documentSlice.ts`, along with their existing unit tests in `documentSlice.test.ts` and the `setSimpleRootType` entry in `DocumentSlice`'s type/`EPPStore`. `normalizeRootForSimpleMode` and `normalizePageForSimpleMode` are untouched (independent caller, unrelated to root-type-switching).

*Alternative considered*: keep `setSimpleRootType` and dispatch to it specifically when `contextNode.id === activePage.rootNode.id && layoutMode === 'simple'`, falling back to `retypeLayoutNode` otherwise (preserving today's image-preservation nuance for that one case). Rejected — explicitly discussed with the user, who chose the single-action simplification over preserving that nuance.

## Risks / Trade-offs

- [Risk] Retyping a Simple-mode root to `imageSlot` no longer preserves a previously assigned image the way it does today — a user mid-experiment switching root types back and forth could lose an assignment they'd expect back. → Mitigation: this was explicitly raised with and accepted by the user during explore mode as an intentional simplification, not a silent regression; document it in the change's proposal (done) so it's visible in history if anyone asks "why did this change" later.
- [Risk] Removing the "select a node" placeholder means there's no longer any UI state where Properties panel shows nothing — if some future feature wanted a genuine "nothing to show" state, this design forecloses it. → Mitigation: low likelihood given every page always has a root node by construction (`createDefaultPage` guarantees it), and the explicit goal here is exactly to eliminate the placeholder case.
