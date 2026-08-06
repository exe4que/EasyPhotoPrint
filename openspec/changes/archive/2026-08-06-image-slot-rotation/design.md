## Context

`computeImageDisplayRectMm` (`src/lib/imageDisplay.ts`) wraps four pure geometry functions in `packages/layout-engine/src/imageFit.ts` (`computeFitInParent`, `computeEnvelopeCrop`, `computeStretch`, `computeSpecificSize`) that all operate on the image's native pixel dimensions (`asset.widthPx`/`heightPx`) against a slot box in millimeters. `PageStage.tsx` calls `computeImageDisplayRectMm` once to size/position the rendered `<img>` and a second time (via the same values) to build the yellow `DimensionOverlay` label text. Neither the fit functions nor their callers know anything about rotation today — `FreeformElement.tsx` has its own, unrelated continuous rotation (`transform.rotationDeg`, drag-driven) that this change does not touch.

See proposal.md — Why for motivation.

## Goals / Non-Goals

**Goals:**
- One rotation-aware code path that all four scaling rules and the dimension label go through, so there is no per-rule rotation logic to keep in sync.
- The public contract of `computeImageDisplayRectMm` stays "the on-screen rect within the slot box" — callers (renderer, label) never need rotation-specific branches.

**Non-Goals:**
- Arbitrary/continuous rotation for `imageSlot` images (only the four 90°-step values) — see proposal.md for why this is a deliberately smaller feature than `FreeformElement`'s existing free rotation.
- Persisting or exposing rotation on the shadow `imageSlot` behind a `FreeformElement` — the field exists on the shared `ImageSlotConfig` type but the UI never surfaces it there.
- Rotating the crop source pixels themselves (e.g. writing a rotated copy of the file to disk) — rotation is a presentation-time transform only, same spirit as the existing scaling rules.

## Decisions

**Swap-the-box, then CSS-rotate-the-result, rather than rotating pixel/crop math.** For `imageRotationDeg` of `90`/`270`, every fit function is called with a box that has `w`/`h` swapped relative to the slot's real box; the raw `asset.widthPx`/`heightPx` passed to `computeEnvelopeCrop`/`computeStretch` are *not* swapped, because the crop still has to address the source file in its own unrotated pixel space (`computeEnvelopeCrop`'s output `left/top/width/height` are pixel coordinates into the original file — rotating those would require re-deriving crop math per orientation, duplicating each of the four functions). Swapping only the target box means:
- `computeFitInParent`/`computeStretch` only compare aspect ratios, so swapping the box alone reorients the comparison correctly with zero changes to those functions.
- `computeEnvelopeCrop`'s `targetAspect` argument is already a plain number computed by the caller (`slotBox.w / slotBox.h` today) — passing the swapped ratio instead is a one-line change at the call site, no change inside `computeEnvelopeCrop` itself. The focal point stays untouched (per the spec's explicit scenario) because it's applied inside that same unchanged function.
- `computeSpecificSize` is pure centering geometry; swapping its input box (not `specificSizeMm`, since that value is defined as the on-screen size per the template-schema delta) computes where to center the *pre-rotation* rect, which then gets rotated into place.

*Alternative considered*: rotate the actual crop rectangle / pixel math per orientation (e.g. four branches inside `computeEnvelopeCrop`). Rejected — quadruples the surface area to test for no behavioral benefit, and risks exactly the kind of per-rule drift the "one rotation-aware path" goal is meant to avoid.

**`computeImageDisplayRectMm` takes the rotation and does the swap-back internally**, returning the final on-screen rect (same contract as today, rotation is just another input alongside `scalingRule`). A new sibling export, `getImageRenderTransform` (exact name TBD at implementation time), returns what the `<img>` element itself needs: the *pre-rotation* width/height/offset (i.e. the fit computed against the swapped box, not swapped back) plus the `imageRotationDeg` to apply as a CSS `transform: rotate(...)`, both centered on the same point. Two exports instead of one because the renderer and the label have different needs from the same underlying computation — the label wants the finished on-screen numbers, the renderer additionally needs the pre-rotation working rect to actually size the DOM node before rotating it.

*Alternative considered*: have `computeImageDisplayRectMm` return only the on-screen rect and make `PageStage.tsx` re-derive the pre-rotation render rect by swapping it back a second time. Rejected — that swap-back-of-a-swap-back is exactly the kind of rotation-specific logic the design goal says callers shouldn't need; centralizing both derivations next to the fit math (where the swap already happened once) is less error-prone than asking the renderer to invert it.

**Rotation is applied via CSS `transform: rotate()` around the slot's own center**, the same mechanism `FreeformElementView` already uses for its independent rotation — proven pattern in this codebase, and keeps the underlying `<img src>` untouched (no canvas re-encoding, no extra asset processing).

**UI control**: a single "Rotate 90°" button in "Slot properties" (`PropertiesPanel.tsx`) next to the scaling-rule select, cycling `imageRotationDeg` through `0 → 90 → 180 → 270 → 0` via a new `rotateSlotImage(pageId, nodeId)` store action (or a direct `updateLayoutNode` patch — implementation detail for tasks.md). A single cycling button was chosen over a 4-option select to match the mental model of "rotate the photo" as a repeatable action rather than picking an absolute orientation, and mirrors common photo-editor UX; either is a small change if this doesn't feel right in practice.

## Risks / Trade-offs

- [Risk] `stretch`'s existing distortion-warning formula (`|sourceAspect - slotAspect| / sourceAspect`) is asymmetric in its two inputs, so swapping both aspects for 90°/270° does not algebraically reduce to the un-rotated formula — the numeric threshold behavior at 90°/270° is consistent with itself but not a trivial identity with 0°/180°. → Mitigation: this asymmetry already exists in the un-rotated formula today (it was never symmetric between source and target); the rotation tests should assert the swapped formula's behavior directly rather than assume it matches an un-rotated case by construction, so this stays a known, tested characteristic rather than a silent surprise.
- [Risk] Two new exports (display rect + render transform) instead of one is more API surface. → Mitigation: both are thin, pure, colocated functions in the same module as the existing fit helpers; the alternative (callers re-deriving the swap) was judged more error-prone, not less code.

## Open Questions

None — the swap-then-rotate approach and the two-export split resolve every case the four scaling rules and the label need; naming (`getImageRenderTransform` etc.) is a normal implementation detail to settle while writing the code, not a decision that would change the spec or task breakdown.
