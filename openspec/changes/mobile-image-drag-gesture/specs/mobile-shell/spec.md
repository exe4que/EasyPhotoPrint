## ADDED Requirements

### Requirement: Photos Sheet Closes During an Armed Library-Image Drag and Reopens After
When the `Photos` bottom sheet is open and the user arms a library-image pointer drag (per the `canvas-interaction` capability's "Library Image Drag Assigns or Places Via a Pointer Gesture" requirement) on one of its cards, the mobile shell SHALL close the `Photos` sheet immediately so the canvas underneath becomes reachable as a drop target, and SHALL reopen it once the drag ends, regardless of whether the drop assigned or placed the image.

#### Scenario: Arming a drag from an open Photos sheet closes it
- **WHEN** the `Photos` sheet is open and the user arms a library-image drag on one of its cards
- **THEN** the `Photos` sheet SHALL close immediately, leaving the canvas fully visible for the rest of the gesture

#### Scenario: Dropping on a valid target reopens Photos after assigning
- **WHEN** an armed library-image drag ends with the pointer released over an `imageSlot` or a `freeformCanvas`
- **THEN** the image SHALL be assigned or placed as `canvas-interaction` defines
- **AND** the `Photos` sheet SHALL reopen automatically afterward

#### Scenario: Dropping outside any target still reopens Photos
- **WHEN** an armed library-image drag ends with the pointer released outside any `imageSlot` or `freeformCanvas`
- **THEN** no assignment or placement SHALL occur
- **AND** the `Photos` sheet SHALL reopen automatically afterward

#### Scenario: Reopening Photos does not trigger the Properties auto-sheet
- **WHEN** the `Photos` sheet reopens after a library-image drag ends
- **THEN** the Properties sheet SHALL NOT open as a result — the drag-assign gesture does not change `ui.selection`, so the "Properties Rises As Its Own Sheet On Selection" requirement has nothing to react to
