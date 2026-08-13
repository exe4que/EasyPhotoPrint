## Why

An `imageSlot` using the `envelopeParent` scaling rule always crops around a fixed center point, so any part of the image that overflows the slot horizontally or vertically is permanently hidden with no way for the user to choose which portion shows. At the same time, the existing gesture for dragging an already-assigned image out of one slot and onto another occupies the exact same press-and-drag interaction on a slot's image, so the two features cannot coexist on the same gesture.

## What Changes

- Pressing and dragging on an `imageSlot`'s image while its `scalingRule` is `envelopeParent` SHALL pan the visible crop region instead of doing nothing: the drag updates the slot's existing `focalPoint` field, letting the user choose which portion of the image is visible within the slot.
- Panning is limited to whichever axis the image actually overflows the slot on (width, height, both, or neither, depending on the image's and slot's aspect ratios) — dragging never moves the focal point on an axis where the image doesn't overflow.
- **BREAKING**: The existing feature that lets the user drag an already-assigned image from one grid/flex `imageSlot` onto another to move or swap it is removed entirely, for every scaling rule, not just `envelopeParent` — the two gestures both start from a press-and-drag on an assigned slot's image and are not compatible with each other. Assigning an image from the Image Library onto a slot (replace, and same-image-on-multiple-slots) is unaffected.
- The editor canvas's on-screen rendering of an `envelopeParent` slot is updated to honor `focalPoint` instead of always centering the crop via plain CSS `object-fit: cover` — needed for the new drag to have any visible effect.
- PDF export and printing (`electron/main/pdf/composeProjectPdf.ts` and its Android equivalent) are updated to pass the slot's actual `focalPoint` into `computeEnvelopeCrop` — today both call it without a `focalPoint` argument at all, so they always fall back to its center default regardless of what's stored on the slot. This was found during implementation, not anticipated in the original proposal: without this fix, a panned `envelopeParent` slot would show correctly in the editor and print-preview but silently revert to a centered crop in the actual exported/printed output, making the feature pointless for its main use case. Fixing it is what `pdf-export`'s and `printing`'s existing "rendered exactly as print preview" requirements already call for — no spec text changes, since neither requirement's normative text needs to change, only the implementation needs to catch up to it.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `canvas-interaction`: adds the pointer-drag pan gesture for `envelopeParent` `imageSlot`s (repositioning `focalPoint`), and documents that pressing-and-dragging an assigned slot's image no longer arms a move/swap onto another slot.
- `project-persistence`: removes the "Assignment Logic Swaps When the Source Is Another Slot on the Same Page" requirement — the `source: 'page'` assignment path it describes has no remaining producer once the slot-to-slot drag gesture is gone, so `assignImageToSlot` only ever performs the existing library-replace behavior.
- `undo-redo`: adds a "pan gestures batch into a single undo step" requirement for the new focal-point drag, following the same pause/apply-live/resume pattern already documented for divider-drag and freeform-transform gestures.

## Impact

- `src/components/canvas/PageStage.tsx` — remove the `createImageDragProps(..., 'page')` / `createSlotDropProps` wiring that currently arms slot-to-slot HTML5 drag on an assigned slot; add the new pointer-drag pan gesture for `envelopeParent` slots.
- `src/hooks/useDragAndDrop.ts` — drop the now-unused `'page'` drag source.
- `src/store/documentSlice.ts` — remove the page-source swap branch from `assignImageToPage`/`assignImageToSlot` (dead once its only caller is gone).
- `src/components/canvas/SlotImage.tsx` / `src/lib/imageDisplay.ts` — render `envelopeParent` using the slot's `focalPoint` (via `computeEnvelopeCrop`-equivalent positioning) instead of unconditional `object-fit: cover`.
- `electron/main/pdf/composeProjectPdf.helpers.ts` — add `focalPoint` to `ImagePlacementSpec`, populated from `imageSlotConfig?.focalPoint` for both `imageSlot` and freeform-element placements.
- `electron/main/pdf/composeProjectPdf.ts` and `src/lib/android/composeProjectPdf.ts` — pass `spec.focalPoint` into `computeEnvelopeCrop` instead of omitting it.
- `openspec/specs/project-persistence/spec.md` — the swap requirement and its 4 scenarios are removed via delta.
- `openspec/specs/canvas-interaction/spec.md` — new requirement + scenarios for the pan gesture, plus a scenario documenting the removed slot-to-slot drag.
- `openspec/specs/undo-redo/spec.md` — new requirement batching the pan gesture into a single undo step.
- No change to the `imageSlotConfig.focalPoint` schema itself (`template-schema`/`layout-engine`) — the field and its crop math already exist and are reused as-is.
