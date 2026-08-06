## MODIFIED Requirements

### Requirement: Undo and Redo Controls
The application SHALL expose controls that invoke undo and redo against the temporal history of the `document` slice, reachable exclusively through the application menu's `Edit > Undo` / `Edit > Redo` items and their keyboard accelerators (`CmdOrCtrl+Z` / `CmdOrCtrl+Shift+Z`). There SHALL NOT be a dedicated in-app toolbar button for undo or redo.

#### Scenario: Undo reverts the most recent document change
- **WHEN** the user activates the Undo control after making a document change
- **THEN** the `document` slice reverts to its state before that change

#### Scenario: Redo re-applies an undone change
- **WHEN** the user activates the Redo control immediately after an Undo
- **THEN** the `document` slice returns to the state it had before the undo was performed

#### Scenario: Undo and Redo are reachable only via the application menu
- **WHEN** the user wants to undo or redo a document change
- **THEN** they invoke it through `Edit > Undo` / `Edit > Redo` (menu click or `CmdOrCtrl+Z` / `CmdOrCtrl+Shift+Z`)
- **AND** no standalone toolbar button exists for this purpose
