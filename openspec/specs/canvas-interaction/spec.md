# canvas-interaction Specification

## Purpose

The canvas-interaction capability defines how pointer input (mouse, touch, or pen) drives direct-manipulation gestures on the canvas — resizing a container by dragging its divider, moving/resizing/rotating a freeform element, and dragging a library image onto a slot or freeform canvas to assign or place it — so every canvas interaction is available the same way regardless of input device.

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
