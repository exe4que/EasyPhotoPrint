## MODIFIED Requirements

### Requirement: Trimmed application menu
The application SHALL replace Electron's default application menu with a reduced menu template containing only `File` (with `New`, `Open...`, `Save`, `Save As...`, and a platform-appropriate `Close`/`Quit` item), `Edit` (a custom submenu with explicit `Undo` and `Redo` items plus the standard `Cut`, `Copy`, `Paste`, and `Select All` roles), `Help`, and — on macOS — the app menu (`appMenu` role). The menu SHALL NOT include `View` or `Window` groups.

#### Scenario: Application menu is built at startup
- **WHEN** the app finishes starting
- **THEN** it SHALL call `Menu.setApplicationMenu` with a custom template
- **AND** that template SHALL contain a `File` menu with, in order: a `New` item (accelerator `CmdOrCtrl+N`), an `Open...` item (accelerator `CmdOrCtrl+O`), a `Save` item (accelerator `CmdOrCtrl+S`), a `Save As...` item (accelerator `CmdOrCtrl+Shift+S`), and finally a `Close` role on macOS or a `Quit` role elsewhere
- **AND** that template SHALL contain an `Edit` menu with, in order: an `Undo` item (accelerator `CmdOrCtrl+Z`), a `Redo` item (accelerator `CmdOrCtrl+Shift+Z`), a separator, and the standard `Cut`, `Copy`, `Paste`, and `Select All` roles, and a `Help` menu
- **AND**, on macOS, the template SHALL also include the `appMenu` role as its first entry
- **AND** the template SHALL NOT contain `View` or `Window` menu groups

## ADDED Requirements

### Requirement: Edit > Undo and Redo Round-Trip Through the Renderer
Because the Main process has no access to the renderer's Zustand/zundo store, clicking `Edit > Undo` or `Edit > Redo` (or using their accelerators) SHALL NOT invoke Chromium's built-in `webContents.undo()`/`redo()`. Each SHALL instead send a distinct, payload-free menu event (`menu:undo`, `menu:redo`) to the focused window's renderer, and the renderer SHALL be responsible for invoking the document undo/redo history itself. This mirrors the existing `menu:new-project`/`menu:save-project` pattern.

#### Scenario: Menu clicks notify the renderer instead of triggering browser-native undo
- **WHEN** the user clicks `Edit > Undo` or `Edit > Redo` (or uses their `CmdOrCtrl+Z`/`CmdOrCtrl+Shift+Z` accelerators)
- **THEN** the Main process SHALL send the corresponding `menu:undo` or `menu:redo` event to the focused `BrowserWindow`'s renderer
- **AND** Main SHALL NOT call `webContents.undo()`/`webContents.redo()` or otherwise touch document state itself

#### Scenario: Renderer subscribes to each event via a preload-exposed API
- **WHEN** the renderer app mounts
- **THEN** it SHALL subscribe to both menu events via `window.eppAPI.menu.onUndo(callback)` and `window.eppAPI.menu.onRedo(callback)`
- **AND** each subscription SHALL be implemented in the preload script by wrapping `ipcRenderer.on`/`ipcRenderer.removeListener`, the same pattern used for `onNewProject`
- **AND** calling the value returned by each subscription function SHALL unsubscribe that listener

#### Scenario: Receiving the event invokes the document undo/redo history
- **WHEN** the renderer receives a `menu:undo` or `menu:redo` event
- **THEN** it SHALL invoke `useEPPStore.temporal.getState().undo()` or `.redo()` respectively
- **AND** if there is nothing to undo or redo, invoking it SHALL have no effect (the temporal store's own no-op behavior applies; the menu item itself is not disabled based on history state)
