## ADDED Requirements

### Requirement: Library Image Drag Assigns or Places Via a Pointer Gesture
A pointer-driven drag gesture on an Image Library card — using the Pointer Events API with pointer capture, the same mechanism this capability already uses for divider resize and freeform move/resize/rotate, not HTML5 drag-and-drop — SHALL let the user assign that image to an `imageSlot` or place it as a new freeform element on a `freeformCanvas` by dragging it there and releasing over the target. This is a distinct mechanism from the existing HTML5 drag-and-drop path, which SHALL continue to work unchanged.

#### Scenario: Moving outside the Image Library panel arms the drag
- **WHEN** the user presses down on a library image card with any pointer type and moves the pointer to a position outside the Image Library panel before releasing
- **THEN** a drag SHALL arm for that image, and a floating preview of the image SHALL track the pointer for the remainder of the gesture

#### Scenario: A press that never leaves the panel is left as an ordinary tap or scroll
- **WHEN** the user presses down on a library image card and moves the pointer, but its position never leaves the Image Library panel before releasing
- **THEN** no drag SHALL arm — the press SHALL be left to behave as an ordinary tap (the existing select/toggle behavior for that card) or as the panel's own native scroll, unaffected by this gesture

#### Scenario: Releasing an armed drag over an imageSlot assigns the image
- **WHEN** a drag is armed for a library image and the user releases the pointer over an `imageSlot`
- **THEN** that image SHALL be assigned to the slot, the same way a library-source HTML5 drag-and-drop onto it would
- **AND** the active page's selection SHALL NOT change as a result

#### Scenario: Releasing an armed drag over a freeformCanvas places a new element
- **WHEN** a drag is armed for a library image and the user releases the pointer over an empty area of a `freeformCanvas`
- **THEN** that image SHALL be added as a new freeform element at the release point, the same way dropping it there via HTML5 drag-and-drop would
- **AND** the active page's selection SHALL NOT change as a result

#### Scenario: Releasing an armed drag outside any valid target does nothing
- **WHEN** a drag is armed for a library image and the user releases the pointer somewhere other than an `imageSlot` or a `freeformCanvas`
- **THEN** no assignment or placement SHALL occur
- **AND** the active page's selection SHALL NOT change as a result

#### Scenario: The existing HTML5 drag-and-drop path is unaffected
- **WHEN** the user drags a library image using the existing HTML5 drag-and-drop path (for example, with a mouse on the desktop shell)
- **THEN** it SHALL behave exactly as it did before this requirement existed

## REMOVED Requirements

### Requirement: Tap-to-Assign Is an Alternative to Drag-and-Drop
**Reason**: Replaced by the pointer-driven drag gesture above ("Library Image Drag Assigns or Places Via a Pointer Gesture"), which gives touch input a genuine drag instead of a tap-based workaround. Keeping tap-to-assign alongside a real touch drag would leave two inconsistent ways for selecting a library image to carry an assignment side effect — activating a slot/canvas now only ever selects, never assigns, regardless of what's selected.
**Migration**: No data migration. On the mobile shell, assign images via the new pointer-gesture drag from the `Photos` sheet. On desktop, assign images via the existing HTML5 drag-and-drop — there is no longer a non-drag alternative for mouse input. Selecting a library image still sets `{ kind: 'image', id }` and still shows its details in the Properties panel; it no longer arms an assignment on the next slot/canvas activation.

Selecting a library image (the existing `{ kind: 'image', id }` selection, set when a user activates an Image Library card) and then activating an `imageSlot` or an empty area of a `freeformCanvas` SHALL assign that image there — the same effective result as dragging it there from the Image Library panel — without requiring a drag gesture. This SHALL be available in addition to, not instead of, the existing HTML5 drag-and-drop path, which SHALL continue to work unchanged.

#### Scenario: Activating a slot while an image is selected assigns it
- **WHEN** a library image is selected and the user activates (clicks or taps) an `imageSlot`
- **THEN** that image SHALL be assigned to the slot the same way a library-source drag-and-drop onto it would
- **AND** the active page's selection SHALL move to that slot's node afterward

#### Scenario: Activating an empty freeform canvas area while an image is selected places it
- **WHEN** a library image is selected and the user activates (clicks or taps) an empty area of a `freeformCanvas`
- **THEN** that image SHALL be added as a new freeform element centered in the canvas, the same way dropping it there from the Image Library panel at that position would place it at the drop point
- **AND** the active page's selection SHALL move to the new element's node afterward

#### Scenario: Activating a slot or canvas with no image selected behaves as before
- **WHEN** no library image is selected and the user activates an `imageSlot` or a `freeformCanvas`
- **THEN** the existing node-selection behavior SHALL occur, with no assignment or placement side effect

#### Scenario: Assignment via tap consumes the armed selection
- **WHEN** a library image is selected and the user activates a slot or canvas, assigning it
- **THEN** activating a different slot or canvas afterward, without re-selecting an image first, SHALL NOT repeat the assignment — it SHALL fall back to ordinary node-selection behavior, since the selection now points at the just-assigned node instead of the image
