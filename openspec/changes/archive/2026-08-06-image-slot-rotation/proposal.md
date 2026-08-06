## Why

An `imageSlot`'s assigned photo currently always renders in its native orientation. A photo shot in portrait dropped into a landscape slot (or vice versa) can't be corrected without leaving the app — there's no way to rotate the assigned image itself (independent of the slot's own shape) to the orientation the layout actually needs.

## What Changes

- Add a per-`imageSlot` image rotation setting with four possible values (0°, 90°, 180°, 270°, clockwise), applied to the assigned photo only — the slot's own box/shape is unaffected.
- All four scaling rules (`fitInParent`, `envelopeParent`, `stretch`, `specificSize`) continue to behave correctly at every rotation: fitting/cropping/stretching is computed against the image's *rotated* aspect ratio, then the rendered result is rotated back into the slot.
- The yellow image-dimension label (`DimensionOverlay`'s `imageLabel`) reflects the *visual*, post-rotation footprint of the displayed image at every orientation, not the pre-rotation working size.
- A rotation control in the "Slot properties" panel, alongside the existing scaling-rule control, cycling the assigned image through the four orientations.
- Test coverage: each scaling rule validated at all four rotation values, and the dimension-label computation validated at all four rotation values.
- Explicitly out of scope: `FreeformElement`s already support arbitrary rotation via their own drag handle (`transform.rotationDeg`, continuous -180..180) — this change does not touch that path. The new setting only affects a plain `imageSlot` node's own assigned image (grid/flex child or page root), not the shadow `imageSlot` that backs a freeform element.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `template-schema`: `imageSlotConfig` gains a new optional `imageRotationDeg` field (one of `0`, `90`, `180`, `270`, default `0`).
- `layout-engine`: the four image fill-mode requirements (`fitInParent`, `envelopeParent`, `stretch`, `specificSize`) must each account for the slot's `imageRotationDeg` when computing the displayed rect, and the computed rect's `widthMm`/`heightMm` must always represent the on-screen, post-rotation footprint.

## Impact

- Affected code: `packages/layout-engine/src/imageFit.ts` and `types.ts` (rotation-aware fit/crop/stretch math, schema field), `src/lib/imageDisplay.ts` (`computeImageDisplayRectMm` gains a rotation parameter), `src/components/canvas/PageStage.tsx` (image rendering + the yellow label's dimension computation for plain `imageSlot`s), `src/components/panels/PropertiesPanel.tsx` (new rotation control in "Slot properties"), `src/store/documentSlice.ts` (an action to set/cycle `imageRotationDeg`).
- No schema migration needed: the new field is optional and defaults to `0`, so existing saved templates/projects remain valid without any conversion step.
- No change to `FreeformElement`/freeform rendering.
