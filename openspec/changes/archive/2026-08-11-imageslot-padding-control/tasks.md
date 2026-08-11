## 1. Add padding control to imageSlot properties

- [x] 1.1 In `PropertiesPanel.tsx`'s `imageSlot` branch (the `slotPropertyNode` block, "Slot properties" panel), add `renderPaddingInputs({ padding: slotPropertyNode.paddingMm ?? {}, unitSystem, onCommit: (side, valueMm) => updateLayoutNode(activePage.id, slotPropertyNode.id, { paddingMm: { [side]: valueMm } }) })`, matching the existing `grid`/container branches' usage. Placed right before the "Assigned image" summary box.
- [x] 1.2 Confirm this applies to every `imageSlot`, not just a root one — no conditional on `contextNode.id === activePage.rootNode.id`. Confirmed by inspection: `slotPropertyNode` is derived from `contextNode` (`selectedNode ?? activePage.rootNode`) with no root-specific branching anywhere in this code path, so the new control renders identically for a root `imageSlot` and any nested one.

## 2. Verification

- [x] 2.1 Manually verify: on the default single-`imageSlot`-root template, the new padding control changes the visible margin band in the page-preview panel (the dashed outline `PageStage` draws from `rootNode.paddingMm`). Verified live (built app, launched via Playwright's `_electron` under `xvfb-run`, per the repo's E2E recipe): selecting the root slot now shows Padding top/right/bottom/left fields under "Slot properties"; setting Padding top to 30mm moved the margin's top offset from ~5.08px to ~30.5px in the preview (matching the 5mm→30mm change at that zoom level) and the slot's displayed content size shrank from 200.0×292.0mm to 200.0×262.0mm accordingly. Screenshot confirms the visual margin band growing on the top edge only.
- [x] 2.2 Manually verify: a non-root `imageSlot` (e.g. one cell of a `grid`) also shows and correctly edits its own padding, independent of its siblings'. Verified live: retyped the root to a 2-column `grid`, selected slot 1, set its Padding left to 20mm (visible as extra whitespace inset on that slot only in the preview); selected slot 2 and confirmed its own Padding left field still reads `0.0`, unaffected by slot 1's edit.
- [x] 2.3 Run the existing test suite and typecheck to confirm no regressions. `npm run typecheck` (all 4 tsconfigs) and `npm run test` (25 files, 189 tests) both pass clean.

## 3. Spec closure

- [x] 3.1 Run `openspec validate --strict --all` and confirm the `properties-panel` delta spec in this change is valid before archiving. Passed: 18/18 items (all archived specs plus this change's delta).
