## 1. Fix the container-outline filter

- [x] 1.1 In `src/components/canvas/PageStage.tsx`, add a `collectContainerNodes(node)` helper (mirroring `collectImageSlotNodes`/`collectFreeformCanvasNodes`/`collectFlexContainerNodes`) that recursively collects `grid`/`horizontal`/`vertical`/`freeformCanvas` type nodes by walking `children`
- [x] 1.2 Build `containerNodeIds` (a `Set<string>`) from `collectContainerNodes(page.rootNode)` alongside the existing `imageSlotMap`/`freeformCanvasMap`/`flexContainers` derivations
- [x] 1.3 Change the Nested-mode container outline loop's filter from `id !== page.rootNode.id && !imageSlotMap.has(id) && !freeformCanvasMap.has(id)` to `id !== page.rootNode.id && containerNodeIds.has(id)`

## 2. Verify the fix and the new freeformCanvas outline

- [x] 2.1 `npm run typecheck`
- [x] 2.2 `npm run test`
- [x] 2.3 Manually verify in the running app: in Nested mode, place 2+ images inside a `freeformCanvas` — confirm no per-image GUID outline/badge appears (including at small element sizes and zoomed out), and confirm the `freeformCanvas` itself now shows exactly one dashed outline + id badge at its own bounds. Also confirm `grid`/`horizontal`/`vertical` containers still show their outlines as before (no regression), and Simple mode still shows no outlines at all.
