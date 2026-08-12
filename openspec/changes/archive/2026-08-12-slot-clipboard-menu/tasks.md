## 1. Store: clipboard state and slot-property actions

- [x] 1.1 Add `slotClipboard: CopiedSlotProperties | null` to `ui` slice's state and `createInitialUiState` (`src/store/uiSlice.ts`), where `CopiedSlotProperties = { imageAssetId: string | null; scalingRule; imageRotationDeg; paddingMm }`.
- [x] 1.2 Add `copySlotProperties(pageId, nodeId)` action: reads the target `imageSlot` node's config + `activePage.assignments[nodeId]`, writes a `CopiedSlotProperties` snapshot into `ui.slotClipboard` via a plain `set()` (no document mutation, so no undo entry — verify via `useEPPStore.temporal.getState()` history length in a test). *(Implemented as a cross-slice action in `store/index.ts`, alongside `addPage`/`removePage`, since it reads `document` and writes `ui` — same reason those two live there rather than in a single slice.)*
- [x] 1.3 Add a shared `applySlotProperties(pageId, properties: CopiedSlotProperties, targetNodeIds: string[])` action in `documentSlice.ts`: rewrites `rootNode` once (updating each target `imageSlot`'s `imageSlotConfig` and `paddingMm`) and `assignments` for `targetNodeIds`, then issues exactly one `set()`; no-ops (no `set()` call) when `targetNodeIds` is empty.
- [x] 1.4 Add `pasteSlotProperties(pageId, nodeId)`: no-ops if `ui.slotClipboard` is `null`; otherwise calls `applySlotProperties(pageId, ui.slotClipboard, [nodeId])`. *(Also in `store/index.ts`, same cross-slice reasoning as 1.2.)*
- [x] 1.5 Add a local tree walk to find a node's parent (needed to compute siblings) and reuse/reimplement a `collectImageSlotIds`-style walk (mirroring `packages/layout-engine/src/reconcileTemplate.ts`) to compute "every imageSlot in the page" — both scoped to `documentSlice.ts`. *(`findParentAndIndex` for siblings and `collectImageSlotIds` for page-wide already existed in `documentSlice.ts` for other features — reused as-is.)*
- [x] 1.6 Add `copySlotPropertiesToSiblings(pageId, nodeId)`: builds `CopiedSlotProperties` from the source node (same shape as 1.2, not read from clipboard), computes target ids as the source's parent's `imageSlot` children excluding itself, calls `applySlotProperties`.
- [x] 1.7 Add `copySlotPropertiesToPage(pageId, nodeId)`: same as 1.6 but target ids are every `imageSlot` in `activePage.rootNode` excluding the source.

## 2. UI: "⋮" menu on the Properties panel

- [x] 2.1 Create `src/components/panels/SlotClipboardMenu.tsx`: an icon-button dropdown ("⋮") following `MenuBarMenu`'s open/close/outside-click/Escape interaction pattern, with four items — "Copy", "Copy to siblings", "Copy to page", "Paste" — the last disabled when `ui.slotClipboard` is `null`.
- [x] 2.2 Wire the four items to the store actions from section 1, scoped to `activePage.id` and `slotPropertyNode.id`.
- [x] 2.3 Render `<SlotClipboardMenu />` in `PropertiesPanel.tsx`'s `imageSlot` branch (next to the "Slot properties" panel title), and nowhere else (grid/container/library-image branches stay unchanged). *(Via `CollapsiblePanel`'s existing `headerAction` slot, the same mechanism `ImageLibraryPanel` uses for its "Load images" button.)*

## 3. Tests

- [x] 3.1 Store test: `copySlotProperties` captures image/scaling rule/rotation/padding and does not add an undo/redo history entry.
- [x] 3.2 Store test: `pasteSlotProperties` is a no-op with an empty clipboard; with a populated clipboard, overwrites the target slot's properties in exactly one undo step, including onto the same slot that was copied.
- [x] 3.3 Store test: `copySlotPropertiesToSiblings` updates only `imageSlot` siblings under the same parent, leaves non-`imageSlot` siblings untouched, and no-ops (no history entry) when there are no `imageSlot` siblings.
- [x] 3.4 Store test: `copySlotPropertiesToPage` updates every `imageSlot` in the active page's tree regardless of nesting, leaves other pages untouched, and no-ops when there are no other `imageSlot` nodes on the page.
- [x] 3.5 Store/integration test: clipboard content is a value snapshot — mutating or deleting the source slot after copying doesn't change what a later Paste applies.
- [x] 3.6 Component test: the "⋮" menu renders only when the Properties panel shows an `imageSlot`'s properties (selected or root-fallback), not for grid/container/library-image content. *(This repo had no component-testing infra yet — no jsdom, no testing-library. User confirmed adding it rather than skipping; added `jsdom` + `@testing-library/react` as devDependencies, using vitest's per-file `// @vitest-environment jsdom` pragma so the existing DOM-free `.ts` test files are unaffected.)*
- [x] 3.7 Component test: "Paste" is disabled until something has been copied in the session.

## 4. Manual verification

- [x] 4.1 In the running app (Electron and/or web shell), copy a slot's properties, paste onto another slot, and confirm image/scaling/rotation/padding all transfer. *(Verified against a real Electron build via a scripted Playwright driver under Xvfb: retyped the root to `horizontal` to get two sibling slots, set slot-1's scaling rule/rotation/padding, Copy → selected slot-2 → Paste, confirmed all three transferred in the live UI.)*
- [x] 4.2 Verify "Copy to siblings" and "Copy to page" apply immediately (no paste step) and that a single Undo reverts each bulk action completely. *(Same session: "Copy to siblings" from slot-1 updated slot-2's padding immediately with no Paste click, and a single `Ctrl+Z` fully reverted it back to its pre-action value.)*
- [x] 4.3 Verify the "⋮" menu is absent for grid/container nodes and for a selected library image. *(Grid case verified live in the same session. The library-image case is covered by the `PropertiesPanel.test.tsx` component test instead of live E2E — assigning a real image requires driving the native OS file-picker dialog, which isn't practically scriptable here.)*
