# electron-shell Specification

## Purpose
The electron-shell capability defines how Easy Photo Print's Electron process architecture keeps the renderer sandboxed from Node.js and the filesystem, and how the application menu and its "File > New" command round-trip safely between the Main and Renderer processes without the Main process touching application state directly.
## Requirements
### Requirement: Renderer process isolation
The application SHALL create its `BrowserWindow` with `contextIsolation` enabled, `nodeIntegration` disabled, and `sandbox` enabled, so the renderer has no direct access to Node.js APIs.

#### Scenario: Main window is created with a locked-down webPreferences configuration
- **WHEN** the app finishes starting and creates its main window
- **THEN** the window's `webPreferences` SHALL have `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`

### Requirement: Explicit contextBridge API surface
The renderer SHALL access filesystem, dialog, print, PDF, settings, template, and menu-event functionality exclusively through a single `window.eppAPI` object exposed via `contextBridge.exposeInMainWorld`, backed by explicitly named IPC channels invoked through `ipcMain.handle` — never through a generic/eval-style IPC channel.

#### Scenario: Renderer calls into Main only through window.eppAPI
- **WHEN** renderer code needs to open a file dialog, read/write a project, list/save/delete templates, read/write app settings, export a PDF, print a document, or subscribe to menu events
- **THEN** it SHALL do so by calling a method on `window.eppAPI` (namespaced under `dialog`, `fs`, `menu`, `pdf`, `print`, `settings`, or `templates`)
- **AND** each of those methods SHALL correspond to a distinct, explicitly named IPC channel registered in the Main process with `ipcMain.handle`

### Requirement: Trimmed application menu
The application SHALL replace Electron's default application menu with a reduced menu template containing only `File` (with `New`, `Open...`, `Save`, `Save As...`, and a platform-appropriate `Close`/`Quit` item), `Edit` (a custom submenu with explicit `Undo` and `Redo` items plus the standard `Cut`, `Copy`, `Paste`, and `Select All` roles), `Help`, and — on macOS — the app menu (`appMenu` role). The menu SHALL NOT include `View` or `Window` groups.

#### Scenario: Application menu is built at startup
- **WHEN** the app finishes starting
- **THEN** it SHALL call `Menu.setApplicationMenu` with a custom template
- **AND** that template SHALL contain a `File` menu with, in order: a `New` item (accelerator `CmdOrCtrl+N`), an `Open...` item (accelerator `CmdOrCtrl+O`), a `Save` item (accelerator `CmdOrCtrl+S`), a `Save As...` item (accelerator `CmdOrCtrl+Shift+S`), and finally a `Close` role on macOS or a `Quit` role elsewhere
- **AND** that template SHALL contain an `Edit` menu with, in order: an `Undo` item (accelerator `CmdOrCtrl+Z`), a `Redo` item (accelerator `CmdOrCtrl+Shift+Z`), a separator, and the standard `Cut`, `Copy`, `Paste`, and `Select All` roles, and a `Help` menu
- **AND**, on macOS, the template SHALL also include the `appMenu` role as its first entry
- **AND** the template SHALL NOT contain `View` or `Window` menu groups

### Requirement: File > New requests a renderer-side confirmation before resetting state
Clicking the `File > New` menu item SHALL NOT reset any application state directly from the Main process. Instead, Main SHALL notify the renderer of the request, and the renderer SHALL require explicit user confirmation before discarding the current document.

#### Scenario: Menu click notifies the focused renderer window
- **WHEN** the user clicks `File > New` (or uses its `CmdOrCtrl+N` accelerator)
- **THEN** the Main process SHALL send a `menu:new-project` event to the currently focused `BrowserWindow`'s renderer, without itself modifying any document, UI, or image-pool state

#### Scenario: Renderer subscribes to the menu event via a preload-exposed API
- **WHEN** the renderer app mounts
- **THEN** it SHALL subscribe exactly once to new-project menu events via `window.eppAPI.menu.onNewProject(callback)`
- **AND** that subscription SHALL be implemented in the preload script by wrapping `ipcRenderer.on`/`ipcRenderer.removeListener`
- **AND** calling the value returned by `onNewProject` SHALL unsubscribe the listener

#### Scenario: Receiving the event opens a confirmation dialog instead of resetting immediately
- **WHEN** the renderer receives a `menu:new-project` event
- **THEN** it SHALL open a confirmation dialog describing that starting a new project discards the current document and undo/redo history
- **AND** it SHALL NOT modify the document, UI, or image pool state until the user explicitly confirms

#### Scenario: Confirming the dialog resets state as if the app had just launched
- **WHEN** the user confirms the "start a new project" dialog
- **THEN** the store SHALL replace its `document` state with the same initial document factory used at app startup
- **AND** it SHALL replace its `ui` state with the same initial UI state factory used at app startup
- **AND** it SHALL clear the image pool
- **AND** it SHALL clear the undo/redo history so a previous project can no longer be restored via undo

#### Scenario: Cancelling the dialog leaves the current document untouched
- **WHEN** the user dismisses or cancels the "start a new project" confirmation dialog
- **THEN** the document, UI state, image pool, and undo/redo history SHALL remain exactly as they were before the menu event was received

### Requirement: File > Open, Save, and Save As Round-Trip Through the Renderer
Because the Main process has no access to the renderer's Zustand store, clicking `File > Open...`, `File > Save`, or `File > Save As...` SHALL NOT perform any project data work directly in Main. Each SHALL send a distinct, payload-free menu event to the focused window's renderer (`menu:open-project`, `menu:save-project`, `menu:save-project-as`), and the renderer SHALL be responsible for gathering current document/image-pool state and invoking the corresponding `window.eppAPI.fs` method itself. This mirrors the existing `menu:new-project` pattern.

#### Scenario: Menu clicks notify the renderer without touching state
- **WHEN** the user clicks `File > Open...`, `File > Save`, or `File > Save As...` (or uses their accelerators)
- **THEN** the Main process SHALL send the corresponding `menu:open-project`, `menu:save-project`, or `menu:save-project-as` event to the focused `BrowserWindow`'s renderer
- **AND** Main SHALL NOT read or modify any document, UI, or image-pool state as part of handling the click

#### Scenario: Renderer subscribes to each event via a preload-exposed API
- **WHEN** the renderer app mounts
- **THEN** it SHALL subscribe to each of the three menu events via `window.eppAPI.menu.onOpenProject(callback)`, `onSaveProject(callback)`, and `onSaveProjectAs(callback)`
- **AND** each subscription SHALL be implemented in the preload script by wrapping `ipcRenderer.on`/`ipcRenderer.removeListener`, the same pattern used for `onNewProject`
- **AND** calling the value returned by each subscription function SHALL unsubscribe that listener

### Requirement: Edit > Undo and Redo Round-Trip Through the Renderer
Because the Main process has no access to the renderer's store, clicking `Edit > Undo` or `Edit > Redo` (or using their accelerators) SHALL NOT invoke Chromium's built-in `webContents.undo()`/`redo()`. Each SHALL instead send a distinct, payload-free menu event (`menu:undo`, `menu:redo`) to the focused window's renderer, and the renderer SHALL be responsible for invoking the document undo/redo history itself. This mirrors the existing `menu:new-project`/`menu:save-project` pattern.

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
- **THEN** it SHALL invoke the same document undo/redo controls described by the `undo-redo` capability's "Undo and Redo Controls" requirement
- **AND** if there is nothing to undo or redo, invoking it SHALL have no effect (the underlying history's own no-op behavior applies; the menu item itself is not disabled based on history state)

