## MODIFIED Requirements

### Requirement: Undo and Redo Controls
The application SHALL expose controls that invoke undo and redo against the temporal history of the `document` slice: an `Undo` and a `Redo` item in the shared `Edit` menu (the same in-app menu-bar component on every host — see the `electron-shell` capability's "No Custom Application Menu" requirement), and — on Electron — the `CmdOrCtrl+Z` / `CmdOrCtrl+Shift+Z` keyboard shortcuts as an additional trigger for the same action, handled directly in the renderer rather than a native menu accelerator. No control SHALL be disabled based on whether history is currently available; invoking undo/redo with nothing to undo/redo SHALL simply have no effect.

#### Scenario: Undo reverts the most recent document change
- **WHEN** the user activates the Undo control after making a document change
- **THEN** the `document` slice reverts to its state before that change

#### Scenario: Redo re-applies an undone change
- **WHEN** the user activates the Redo control immediately after an Undo
- **THEN** the `document` slice returns to the state it had before the undo was performed

#### Scenario: Undo and Redo are reachable via the Edit menu on every host
- **WHEN** the user opens the `Edit` menu, on any host
- **THEN** it SHALL contain an `Undo` item and a `Redo` item, and activating either SHALL invoke undo/redo respectively

#### Scenario: A keyboard shortcut is an additional trigger on Electron
- **WHEN** the application runs on Electron
- **THEN** `CmdOrCtrl+Z` / `CmdOrCtrl+Shift+Z` SHALL also invoke undo/redo, alongside the `Edit` menu items
