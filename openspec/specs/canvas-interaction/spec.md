# canvas-interaction Specification

## Purpose

The canvas-interaction capability defines how pointer input (mouse, touch, or pen) drives direct-manipulation gestures on the canvas — resizing a container by dragging its divider, and moving/resizing/rotating a freeform element — and the tap-based alternative to drag-and-drop for assigning a library image to a slot or a freeform canvas, so every canvas interaction is available the same way regardless of input device.

## Requirements

### Requirement: Divider Resize Responds to Any Pointer Type
Dragging a container divider (`NodeDivider`) to resize its adjacent siblings SHALL use the Pointer Events API with pointer capture, not mouse-specific events, so the gesture is available identically for mouse, touch, and pen input.

#### Scenario: Dragging a divider with any pointer type resizes its siblings
- **WHEN** the user presses down on an unlocked divider with any pointer type and moves the pointer along the divider's main axis
- **THEN** the divider's adjacent siblings SHALL resize continuously as the pointer moves, the same way it does for a mouse today

#### Scenario: A captured drag survives the pointer leaving the divider's hit area
- **WHEN** a divider drag is in progress and the pointer moves outside the divider's own bounding box while remaining pressed
- **THEN** the drag SHALL continue to receive move events and resize the siblings, exactly as if the pointer were still over the divider

#### Scenario: A locked divider ignores pointer-down regardless of pointer type
- **WHEN** the user presses down on a locked divider
- **THEN** no drag SHALL start, and no resize SHALL occur, for any pointer type

#### Scenario: A second pointer during an active drag does not interfere
- **WHEN** a divider drag is already in progress for one pointer and a second pointer presses down on the same divider
- **THEN** the second pointer SHALL be ignored and the original drag SHALL continue unaffected

### Requirement: Freeform Element Move, Resize, and Rotate Respond to Any Pointer Type
Moving, resizing, or rotating a freeform element (`FreeformElementView`) SHALL use the Pointer Events API with pointer capture, not mouse-specific events, so each gesture is available identically for mouse, touch, and pen input.

#### Scenario: Moving a freeform element with any pointer type
- **WHEN** the user presses down on a selected or unselected freeform element's body with any pointer type and moves the pointer
- **THEN** the element SHALL translate continuously to follow the pointer, the same way it does for a mouse today

#### Scenario: Resizing a freeform element with any pointer type
- **WHEN** the user presses down on a selected freeform element's resize handle with any pointer type and moves the pointer
- **THEN** the element SHALL resize continuously (respecting its aspect-lock setting), the same way it does for a mouse today

#### Scenario: Rotating a freeform element with any pointer type
- **WHEN** the user presses down on a selected freeform element's rotate handle with any pointer type and moves the pointer
- **THEN** the element SHALL rotate continuously to track the pointer's angle around the element's center, the same way it does for a mouse today

#### Scenario: A captured drag survives the pointer leaving the element's bounding box
- **WHEN** a move, resize, or rotate drag is in progress and the pointer moves outside the element's own bounding box while remaining pressed
- **THEN** the drag SHALL continue to receive move events and transform the element, exactly as if the pointer were still over it

### Requirement: Interactive Handles Suppress the Browser's Default Touch Scrolling
Every element that starts a divider or freeform drag (the divider's hit area; a freeform element's move body, resize handle, and rotate handle) SHALL prevent the browser's default touch-scrolling behavior for touch input starting on that element, so a touch-drag on a handle does not simultaneously scroll the containing page-preview viewport.

#### Scenario: Touch-dragging a divider does not scroll the viewport
- **WHEN** the user touch-drags an unlocked divider
- **THEN** the page-preview viewport SHALL NOT scroll as a side effect of that drag

#### Scenario: Touch-dragging a freeform handle does not scroll the viewport
- **WHEN** the user touch-drags a freeform element's body, resize handle, or rotate handle
- **THEN** the page-preview viewport SHALL NOT scroll as a side effect of that drag

### Requirement: Tap-to-Assign Is an Alternative to Drag-and-Drop
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

### Requirement: Tapping the Page Panel's Empty Space Selects the Root Node
Activating (clicking or tapping) the page-preview panel outside any slot, container gap, freeform canvas, or divider — specifically, the root node's own margin band (the area between the page edge and the root's padded content box) or the scrollable viewport's background outside the page rectangle's bounds — SHALL set the selection to the page's root node. This SHALL behave identically everywhere the page-preview panel is rendered (the Electron desktop build and the Android build), since both share the same panel implementation.

#### Scenario: Activating the root's margin band selects the root
- **WHEN** the user activates the area between the page edge and the root node's padded content box (the margin visualized today by a dashed outline)
- **THEN** the active page's selection SHALL become the root node

#### Scenario: Activating the viewport outside the page bounds selects the root
- **WHEN** the user activates the page-preview panel's scrollable background outside the page rectangle itself
- **THEN** the active page's selection SHALL become the root node

#### Scenario: Activating the root selection again clears it
- **WHEN** the root node is already selected and the user activates the margin band or the outside-page-bounds area again
- **THEN** the selection SHALL clear, the same toggle-off convention an `imageSlot` already uses

#### Scenario: Gaps between sibling slots are unaffected
- **WHEN** the user activates the gap space between adjacent children inside a `grid`, `horizontal`, or `vertical` container
- **THEN** no selection change SHALL occur — this requirement does not extend to inter-slot gap space

#### Scenario: A freeform canvas's own empty-area tap is unaffected
- **WHEN** the user activates an empty area of a `freeformCanvas` with no library image selected
- **THEN** the existing node-selection behavior SHALL occur (selecting the canvas node), unchanged by this requirement — the root is not selected in its place
