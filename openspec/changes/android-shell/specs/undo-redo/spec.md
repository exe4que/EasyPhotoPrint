## MODIFIED Requirements

### Requirement: Undo and Redo Controls
The application SHALL expose controls that invoke undo and redo against the temporal history of the `document` slice: a toolbar button (Undo and Redo) present on every host, and — on a host with a native application menu — the application menu's `Edit > Undo` / `Edit > Redo` items and their keyboard accelerators (`CmdOrCtrl+Z` / `CmdOrCtrl+Shift+Z`) as an additional trigger for the same action. No control SHALL be disabled based on whether history is currently available; invoking undo/redo with nothing to undo/redo SHALL simply have no effect.

#### Scenario: Undo reverts the most recent document change
- **WHEN** the user activates the Undo control after making a document change
- **THEN** the `document` slice reverts to its state before that change

#### Scenario: Redo re-applies an undone change
- **WHEN** the user activates the Redo control immediately after an Undo
- **THEN** the `document` slice returns to the state it had before the undo was performed

#### Scenario: Undo and Redo are reachable via a toolbar on every host
- **WHEN** the user wants to undo or redo a document change, on any host
- **THEN** a toolbar button for Undo and a toolbar button for Redo SHALL be present and SHALL invoke undo/redo respectively

#### Scenario: The application menu is an additional trigger where the host has one
- **WHEN** the application runs on a host with a native application menu (for example, Electron)
- **THEN** `Edit > Undo` / `Edit > Redo` (menu click or `CmdOrCtrl+Z` / `CmdOrCtrl+Shift+Z`) SHALL also invoke undo/redo, alongside the toolbar button
