## Purpose

Provide undo/redo history for document edits (layout structure and image assignments) while keeping continuous drag gestures — such as resizing a divider or transforming a freeform element — collapsed into a single undoable step instead of one step per mouse-move event.

## ADDED Requirements

### Requirement: History Scoped to the Document Slice Only
The undo/redo temporal store SHALL track only the `document` slice of the application state (pages, layout tree structure, and image slot assignments). UI state (active page, selection, active tool, layout mode) and the raw image pool SHALL be excluded from the tracked history.

#### Scenario: Selecting a different element does not create an undo step
- **WHEN** the user selects a different layout node or image asset without otherwise modifying the document
- **THEN** no new entry is added to the undo/redo history, because `ui` state changes are not tracked by the temporal store

#### Scenario: Loading images into the pool does not create an undo step
- **WHEN** the user imports new images into the image pool without assigning them to any slot
- **THEN** no new entry is added to the undo/redo history, because `imagePool` changes are not tracked by the temporal store

#### Scenario: Editing the layout tree creates an undo step
- **WHEN** the user changes a document-level property (for example, a node's structure or an image assignment)
- **THEN** a new entry is added to the undo/redo history, and invoking undo reverts that specific change

### Requirement: Undo and Redo Controls
The application SHALL expose controls that invoke undo and redo against the temporal history of the `document` slice.

#### Scenario: Undo reverts the most recent document change
- **WHEN** the user activates the Undo control after making a document change
- **THEN** the `document` slice reverts to its state before that change

#### Scenario: Redo re-applies an undone change
- **WHEN** the user activates the Redo control immediately after an Undo
- **THEN** the `document` slice returns to the state it had before the undo was performed

### Requirement: Divider-Drag Gestures Batch Into a Single Undo Step
Dragging the divider between two adjacent children of a `horizontal` or `vertical` container SHALL pause history recording when the drag starts, apply live sibling-resize updates to the store on every pointer-move event without recording each intermediate state, and resume history recording when the drag ends — so the entire drag gesture collapses into exactly one undo/redo step.

#### Scenario: A single divider drag produces one undo step
- **WHEN** the user presses down on an unlocked divider, moves the pointer through multiple mousemove events resizing the adjacent siblings, and releases the pointer
- **THEN** exactly one new entry is added to the undo/redo history for the entire gesture, and a single Undo reverts both siblings to their sizes before the drag started

#### Scenario: A locked divider does not start a drag
- **WHEN** the user presses down on a divider where an adjacent sibling has a fixed size on the container's main axis
- **THEN** no drag begins, history is not paused, and no sibling sizes change

### Requirement: Freeform Element Transform Gestures Batch Into a Single Undo Step
Moving, resizing, or rotating a `FreeformElement` inside a `freeformCanvas` node SHALL pause history recording when the gesture starts, apply live transform updates to the store on every pointer-move event without recording each intermediate state, and resume history recording when the gesture ends — so the entire move, resize, or rotate gesture collapses into exactly one undo/redo step.

#### Scenario: A single move gesture produces one undo step
- **WHEN** the user presses down on a freeform element's body, drags it through multiple mousemove events, and releases the pointer
- **THEN** exactly one new entry is added to the undo/redo history for the entire gesture, and a single Undo reverts the element to its position before the drag started

#### Scenario: A single resize gesture produces one undo step
- **WHEN** the user presses down on a freeform element's resize handle, drags it through multiple mousemove events, and releases the pointer
- **THEN** exactly one new entry is added to the undo/redo history for the entire gesture, and a single Undo reverts the element to its size before the drag started

#### Scenario: A single rotate gesture produces one undo step
- **WHEN** the user presses down on a freeform element's rotation handle, drags it through multiple mousemove events, and releases the pointer
- **THEN** exactly one new entry is added to the undo/redo history for the entire gesture, and a single Undo reverts the element to its rotation before the drag started

### Requirement: History Reset on New Project
Starting a new project SHALL clear the entire undo/redo history in addition to resetting the document and image pool, so a prior project's edits cannot be restored via undo after starting over.

#### Scenario: Undo has no effect immediately after starting a new project
- **WHEN** the user confirms starting a new project (discarding the current document, image pool, and history)
- **THEN** the undo/redo history is emptied, and invoking Undo afterward has no effect on the freshly reset document
