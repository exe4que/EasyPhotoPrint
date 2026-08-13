## ADDED Requirements

### Requirement: Panning an envelopeParent Image Slot's Focal Point via Pointer Gesture
An `imageSlot` whose `scalingRule` is `envelopeParent` SHALL support a pointer-drag gesture on its displayed image — using the Pointer Events API with pointer capture, the same mechanism this capability already uses for divider resize, freeform move/resize/rotate, and library image drag — that repositions the slot's `focalPoint` so the user can choose which portion of the image is visible within the crop, in place of the fixed default-center crop. The editor canvas's live rendering of the slot SHALL reflect the updated `focalPoint` continuously as the drag proceeds, the same way a divider or freeform drag updates its result continuously.

#### Scenario: Dragging pans the axis the image overflows on
- **WHEN** an `envelopeParent` image's crop overflows the slot along only one axis (its rendered width or height, computed for the slot's aspect ratio, exceeds the slot's) and the user drags along that axis
- **THEN** the `focalPoint` component for that axis SHALL move proportionally to the drag distance, while the other axis's `focalPoint` component SHALL remain unchanged regardless of drag direction

#### Scenario: Dragging pans both axes when the image overflows both
- **WHEN** an `envelopeParent` image's crop overflows the slot on both axes and the user drags diagonally
- **THEN** both `focalPoint.x` and `focalPoint.y` SHALL update, each proportionally to the drag distance along its own axis

#### Scenario: Dragging is a no-op when the image doesn't overflow
- **WHEN** an `envelopeParent` image's crop exactly matches the source image on both axes (no overflow, e.g. matching aspect ratios) and the user drags it
- **THEN** the `focalPoint` SHALL NOT change on either axis

#### Scenario: Panning stays within the image's bounds
- **WHEN** a drag would move the focal point beyond the image's visible bounds
- **THEN** `focalPoint.x` and `focalPoint.y` SHALL each be clamped to the `0..1` range, so the crop never extends past the source image's edges, consistent with the existing envelopeParent crop-clamping behavior

#### Scenario: Non-envelopeParent slots don't arm this gesture
- **WHEN** an `imageSlot`'s `scalingRule` is `fitInParent`, `stretch`, or `specificSize`
- **THEN** pressing and dragging its image SHALL NOT reposition anything — the press SHALL be left to ordinary click/selection behavior, unaffected by this gesture

#### Scenario: Panning never reassigns the image to another slot
- **WHEN** a pan drag on an `envelopeParent` slot's image ends anywhere, including over a different `imageSlot`
- **THEN** the image SHALL remain assigned to its original slot, and no other slot's assignment SHALL change as a side effect
