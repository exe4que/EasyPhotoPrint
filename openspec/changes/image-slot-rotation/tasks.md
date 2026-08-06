## 1. Schema

- [x] 1.1 Add `imageRotationDeg?: 0 | 90 | 180 | 270` to `ImageSlotConfig` in `packages/layout-engine/src/types.ts`

## 2. Rotation-aware fit math (`packages/layout-engine/src/imageFit.ts`)

- [x] 2.1 Add a small helper that swaps a `BoxMm`'s `w`/`h` when a given `imageRotationDeg` is `90` or `270` (no-op for `0`/`180`) — `orientBoxMm`
- [x] 2.2 Update the call site(s) so `computeFitInParent` and `computeStretch` receive the swapped box for `90`/`270`, unchanged for `0`/`180` — no changes needed inside those two functions themselves (done in `computeImageRenderRectMm`; `computeStretch`'s only real call site, `PropertiesPanel.tsx`'s distortion warning, still needs updating — tracked as a new task below)
- [x] 2.3 `computeEnvelopeCrop` has no production call site today (confirmed by repo-wide search — only its own unit test exercises it; envelopeParent renders via CSS `object-fit: cover` on a box sized by §2.2/3.2 instead). No call site to update; the swapped-`targetAspect` pattern is proven directly in its own test (§7.2) instead.
- [x] 2.4 Update `computeSpecificSize`'s call site to pass the swapped slot box for `90`/`270` (the `specificSizeMm` value itself is never swapped — it's always the on-screen size; done via `swapSpecificSizeMm` in `computeImageRenderRectMm`)
- [x] 2.5 Update `PropertiesPanel.tsx`'s `computeStretch(selectedAsset, selectedBox)` distortion-warning call to pass `orientBoxMm(selectedBox, imageRotationDeg)` so the warning reflects the rotated aspect ratio

## 3. Rotation-aware display rect (`src/lib/imageDisplay.ts`)

- [x] 3.1 Add an `imageRotationDeg` parameter to `computeImageDisplayRectMm`; for `90`/`270`, call the layout-engine fit functions per §2 and swap the returned `widthMm`/`heightMm`/offsets back so the result is always the on-screen, post-rotation footprint (per the "Image rotation orientation" requirement) — implemented by recentering the swapped-back size directly against the real slot box, which is provably identical to a literal offset-swap since every scaling rule's result is always centered in its box (verified for all 4 rules at rotation 0 against the pre-existing behavior)
- [x] 3.2 Add a new export (`computeImageRenderRectMm`) returning the *pre-rotation* working size (the swapped-box fit, not swapped back), for the renderer to size the `<img>` before applying the CSS rotation (offset is unneeded — see rationale in the function's doc comment: centering on the slot's own center point plus CSS `rotate()` handles positioning automatically)
- [x] 3.3 `isSpecificSizeUnsatisfied` needs no change: `specificSizeMm` is defined as the on-screen size and it already compares directly against the slot's real box, independent of rotation — confirmed via test (§7.4)

## 4. Rendering (`src/components/canvas/PageStage.tsx`)

- [x] 4.1 Thread `imageSlotMap.get(id)?.imageSlotConfig?.imageRotationDeg` through the existing `computeImageDisplayRectMm` calls (image render + hover hit-testing + the yellow label's dimension text)
- [x] 4.2 Use `computeImageRenderRectMm` to size/position the rendered `<img>` (or its wrapping element) and apply `transform: rotate(<imageRotationDeg>deg)` around the slot's own center, mirroring how `FreeformElementView` already applies `transform.rotationDeg`
- [x] 4.3 Verify the yellow `DimensionOverlay` label continues to read from the on-screen rect (§3.1's return value) so it needs no rotation-specific branching

## 5. Store action (`src/store/documentSlice.ts`)

- [x] 5.1 Add a `rotateSlotImage(pageId, nodeId)` action that cycles the target `imageSlot` node's `imageSlotConfig.imageRotationDeg` through `0 → 90 → 180 → 270 → 0`
- [x] 5.2 Add/extend a unit test in `documentSlice.test.ts` covering the cycle wrap-around (`270 → 0`) and that it's a no-op on the slot's own box/shape

## 6. UI control (`src/components/panels/PropertiesPanel.tsx`)

- [x] 6.1 Add a "Rotate 90°" button in "Slot properties" next to the scaling-rule select, calling `rotateSlotImage`
- [x] 6.2 Confirmed in the running app: the "Image rotation"/"Rotate 90°" control renders in "Slot properties" only when a plain `imageSlot` is selected, right alongside the scaling-rule control

## 7. Tests — scaling rules × rotation (`packages/layout-engine/src/imageFit.test.ts`, `src/lib/imageDisplay.test.ts`)

- [x] 7.1 For each of `fitInParent`, `envelopeParent`, `stretch`, `specificSize`, add cases at `imageRotationDeg` `0`, `90`, `180`, `270` asserting the returned rect is the correct on-screen footprint (`src/lib/imageDisplay.test.ts`, 28 tests, all passing)
- [x] 7.2 `envelopeParent`: assert a non-center focal point produces the same crop-origin behavior at every rotation (`packages/layout-engine/src/imageFit.test.ts` — tested at the `computeEnvelopeCrop` level directly, since it has no production call site yet; `computeImageDisplayRectMm`'s envelopeParent path is covered separately as a full-box-fill invariant)
- [x] 7.3 `stretch`: assert the distortion-warning boundary is evaluated against the rotation-swapped aspect ratios at `90`/`270` — found a concrete case (2:1 image, ~1.72:1 slot) where the warning is `false` at 0deg and `true` at 90deg for the identical image+slot, confirming rotation genuinely changes distortion risk
- [x] 7.4 `specificSize`: assert `specificSizeMm` is always interpreted as the on-screen size at every rotation, and `isSpecificSizeUnsatisfied` compares against the slot's real (un-swapped) box at every rotation — confirmed unchanged/correct with no code changes needed

## 8. Tests — dimension label

- [x] 8.1 Add tests asserting the yellow label's width×height text (as computed from `computeImageDisplayRectMm`, formatted via the same `formatLength` PageStage.tsx uses) is correct at all four `imageRotationDeg` values for `fitInParent`, plus a same-text-at-every-rotation invariant test for `specificSize`

## 9. Verification

- [x] 9.1 `npm run build` (typecheck via `tsc -p tsconfig.json` for the layout-engine/migrations packages) and the root `tsc --noEmit` — clean
- [x] 9.2 Full `vitest run` — 126/126 tests passing across 18 files
- [x] 9.3 Launched the real app (Electron + Playwright, per the project's E2E recipe) with a portrait test image (marked with a "TOP" band to confirm rotation direction) assigned to a landscape root `imageSlot`. Cycled `fitInParent` through all four rotations: 0°/180° letterboxed identically as expected, 90°/270° each produced an exact fill (a 1:2 portrait rotated 90° exactly matches a 2:1 landscape slot) with the "TOP" band correctly landing on the right (90°) and left (270°) edges, confirming clockwise rotation direction. Also confirmed `specificSize` at 90°: label read "60.0mm × 40.0mm" (the configured on-screen size, unchanged by rotation, matching the spec), image visibly rotated with the "TOP" band on the right edge.
