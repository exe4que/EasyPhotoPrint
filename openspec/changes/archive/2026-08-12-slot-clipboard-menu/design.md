## Context

`PropertiesPanel.tsx` already resolves a `slotPropertyNode` (the in-view `imageSlot`, selected or root-fallback) and a `contextNode`/`activePage`. The document store (`src/store/documentSlice.ts`, composed into `useEPPStore` in `src/store/index.ts`) wraps only the `document` slice in zundo's `temporal()`, via `partialize: (state) => ({ document: state.document })` — any `set()` call that leaves `document` untouched creates no undo entry, and any single `set()` call that changes `document` (however many nodes it touches) creates exactly one entry, matching how `addPage`/`removePage` already batch a page-plus-ui update into one `set()`. `packages/layout-engine/src/reconcileTemplate.ts` already has a `collectImageSlotIds(node, into)` walker for a similar "every imageSlot in this tree" need. `src/components/ui/MenuBar.tsx`'s `MenuBarMenu` is an existing small floating-dropdown component (click to open, closes on outside click/Escape/item pick) that the "⋮" menu can reuse the same interaction pattern from, without literally being a `MenuBarMenu` (that one is styled as a text label in a horizontal bar; the new one is an icon button).

See proposal.md for the feature motivation; see specs/slot-clipboard/spec.md and specs/properties-panel/spec.md (delta) for the exact required behavior.

## Goals / Non-Goals

**Goals:**
- Reuse the existing single-`set()`-call-per-action pattern so every clipboard action is automatically exactly one undo step (or zero, when it's a no-op or doesn't touch `document`), with no new batching/pause-resume machinery.
- Keep clipboard state out of `document` so Copy never touches undo/redo history.

**Non-Goals:**
- No cross-app/OS clipboard integration (no `navigator.clipboard`, no serialization) — this is in-memory app state only, per the spec's session-scope requirement.
- No multi-select copy/paste (copying from or to more than one slot at a time) beyond the three bulk actions already specified (siblings/page).

## Decisions

**Clipboard state lives in `ui` slice, not a new store slice.**
`ui` is already excluded from temporal tracking (see `undo-redo` spec's "History Scoped to the Document Slice Only") and is already the home for other transient, non-persisted, session-scoped state (`activePageId`, `selection`, `layoutMode`). Adding `ui.slotClipboard: CopiedSlotProperties | null` reuses that existing exclusion instead of standing up a new slice with its own `partialize`/`equality` wiring. Alternative considered: a dedicated `clipboardSlice` — rejected as unnecessary indirection for one nullable field.

**`CopiedSlotProperties` is a plain value snapshot, not a node/id reference.**
`{ imageAssetId: string | null; scalingRule; imageRotationDeg; paddingMm }` — captured by value at Copy time. This directly satisfies the spec's "clipboard survives edits to its source slot" requirement for free (nothing to invalidate) and keeps Paste/apply logic identical regardless of where the values came from.

**Bulk apply (`Copy to siblings` / `Copy to page`) and `Paste` share one store action shaped by target-id list.**
A single `documentSlice` action, e.g. `applySlotProperties(pageId, sourceOrClipboardProps, targetNodeIds: string[])`, walks `rootNode` once, replaces every node whose id is in `targetNodeIds`, and issues one `set()`. `Copy to siblings` computes `targetNodeIds` by finding the source node's parent — `documentSlice.ts` already had a private `findParentAndIndex` walk for this, built for the specific-size divider-growth feature, reused as-is — and taking that parent's `imageSlot` children. `Copy to page` computes `targetNodeIds` via `documentSlice.ts`'s existing private `collectImageSlotIds` (already used by `filterAssignmentsForRootNode`), the same shape as `reconcileTemplate.ts`'s own copy in the `layout-engine` package — both already existed before this change, so no new tree walk needed writing. Empty `targetNodeIds` short-circuits before calling `set()`, satisfying the "no undo entry on no-op" scenarios.
Alternative considered: three separate store actions (`copyToSiblings`, `copyToPage`, `pasteToSlot`) with duplicated tree-rewrite logic — rejected in favor of the shared `applySlotProperties` primitive; the three call sites differ only in how they compute `targetNodeIds` and where the source properties come from (selected node vs. clipboard).

**Menu UI is a new small component, `SlotClipboardMenu.tsx`, colocated in `src/components/panels/`.**
It follows `MenuBarMenu`'s open/close/outside-click/Escape pattern (copy that ~25-line interaction block rather than generalizing `MenuBarMenu` itself, since that component's styling is bar-specific) but renders a "⋮" icon button instead of a text label, and a simple `<button>`-per-action list instead of `MenuBarItem`'s shape. It reads `ui.slotClipboard` to decide whether "Paste" is disabled and calls the three store actions (`copySlotProperties`, `applySlotProperties` twice with different target computations, `pasteSlotProperties` — or equivalent names chosen during implementation) directly.

## Risks / Trade-offs

**[Risk]** Reimplementing a small `imageSlot`-collecting tree walk in `documentSlice.ts` duplicates the shape of `reconcileTemplate.ts`'s `collectImageSlotIds`, rather than sharing one implementation. → **Mitigation**: the walk is ~5 lines with no shared types beyond `LayoutNode`; duplicating it avoids a cross-package import between `packages/layout-engine` and `src/store` for a trivial function, which would be a larger structural change than this feature warrants.

**[Risk]** "Copy to siblings"/"Copy to page" apply immediately with no confirmation step, so a user who picks the wrong source slot overwrites many slots' properties in one click. → **Mitigation**: this matches the proposal's explicit requirement (no separate paste step), and the action is fully undoable in one step via the existing Undo control/`CmdOrCtrl+Z`.

**[Risk, discovered during implementation]** The tasks called for a component test of the "⋮" menu's visibility and Paste's disabled state, but the repo had no React component-testing setup at all (no jsdom/happy-dom, no `@testing-library/react` — every existing test is a DOM-free `.ts` store/unit test). Adding that is a real new-dependency decision, not an implementation detail, so it was surfaced to the user rather than added silently. → **Resolution**: user chose to add it. Added `jsdom` and `@testing-library/react` as devDependencies; the new component test (`PropertiesPanel.test.tsx`) opts into jsdom per-file via vitest's `// @vitest-environment jsdom` pragma rather than changing the global test environment, so the existing DOM-free `.ts` tests keep running under the faster default `node` environment, unaffected.
