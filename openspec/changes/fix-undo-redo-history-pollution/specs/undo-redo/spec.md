## MODIFIED Requirements

### Requirement: History Scoped to the Document Slice Only
The undo/redo temporal store SHALL track only the `document` slice of the application state (pages, layout tree structure, and image slot assignments). UI state (active page, selection, active tool, layout mode) and the raw image pool SHALL be excluded from the tracked history: an action that changes only UI state SHALL NOT add a new entry to the undo/redo history, and SHALL NOT clear the redo (future) stack, regardless of how many such actions occur in sequence.

#### Scenario: Selecting a different element does not create an undo step
- **WHEN** the user selects a different layout node or image asset without otherwise modifying the document
- **THEN** no new entry is added to the undo/redo history, because `ui` state changes are not tracked by the temporal store

#### Scenario: Switching pages, changing layout mode, or changing the active tool does not create an undo step
- **WHEN** the user switches the active page, toggles the Simple/Nested layout mode, or changes the active tool, without otherwise modifying the document
- **THEN** no new entry is added to the undo/redo history for any of these actions, individually or in sequence

#### Scenario: A UI-only action never clears the redo stack
- **WHEN** the user has just undone a document change (so a redo entry exists), then performs a UI-only action such as selecting an element or switching pages
- **THEN** the redo entry from before the UI-only action remains available, and redo still re-applies the previously undone document change

#### Scenario: Loading images into the pool does not create an undo step
- **WHEN** the user imports new images into the image pool without assigning them to any slot
- **THEN** no new entry is added to the undo/redo history, because `imagePool` changes are not tracked by the temporal store

#### Scenario: Editing the layout tree creates an undo step
- **WHEN** the user changes a document-level property (for example, a node's structure or an image assignment)
- **THEN** a new entry is added to the undo/redo history, and invoking undo reverts that specific change
