## ADDED Requirements

### Requirement: envelopeParent Pan Gestures Batch Into a Single Undo Step
Panning an `envelopeParent` `imageSlot`'s image (per `canvas-interaction`'s panning gesture) SHALL pause history recording when the drag starts, apply live `focalPoint` updates to the store on every pointer-move event without recording each intermediate state, and resume history recording when the drag ends — so the entire pan gesture collapses into exactly one undo/redo step.

#### Scenario: A single pan drag produces one undo step
- **WHEN** the user presses down on an `envelopeParent` slot's image, moves the pointer through multiple pointer-move events panning the visible crop, and releases the pointer
- **THEN** exactly one new entry is added to the undo/redo history for the entire gesture, and a single Undo reverts the slot's `focalPoint` to its value before the drag started

#### Scenario: A pan drag that doesn't move the focal point does not create an undo step
- **WHEN** the user presses down on an `envelopeParent` slot's image and releases the pointer without the drag ever moving the `focalPoint` (for example, the image doesn't overflow the slot on either axis)
- **THEN** no new entry is added to the undo/redo history for that gesture
