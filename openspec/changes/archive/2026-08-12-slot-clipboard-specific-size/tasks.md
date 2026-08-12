## 1. Store: carry specific-size dimensions through the clipboard

- [x] 1.1 Add `specificSizeMm: SpecificSizeMm | undefined` to `CopiedSlotProperties` (`src/store/documentSlice.ts`).
- [x] 1.2 Update `captureSlotProperties` to include `sourceNode.imageSlotConfig?.specificSizeMm` when `scalingRule === 'specificSize'` (and `undefined` otherwise).
- [x] 1.3 Update `applySlotPropertiesToNode` to write `specificSizeMm` into the target's `imageSlotConfig` alongside `scalingRule`/`imageRotationDeg`.

## 2. Tests

- [x] 2.1 `captureSlotProperties` test: capturing a `specificSize`-configured slot includes its `specificSizeMm`; capturing a slot with any other scaling rule does not.
- [x] 2.2 `applySlotProperties`/paste test: applying a `specificSize` clipboard entry sets the target's `specificSizeMm` to match; applying a non-`specificSize` entry leaves the target without a stale `specificSizeMm`.
- [x] 2.3 Extend the existing `copySlotPropertiesToSiblings`/`copySlotPropertiesToPage` tests (or add new ones) covering a `specificSize` source slot.

## 3. Verification

- [x] 3.1 `npm run typecheck` and `npm test` pass.
- [x] 3.2 `openspec validate --strict --all` passes.
