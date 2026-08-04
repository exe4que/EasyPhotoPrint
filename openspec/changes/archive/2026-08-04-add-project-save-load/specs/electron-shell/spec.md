## MODIFIED Requirements

### Requirement: Trimmed application menu
The application SHALL replace Electron's default application menu with a reduced menu template containing only `File` (with `New`, `Open...`, `Save`, `Save As...`, and a platform-appropriate `Close`/`Quit` item), `Edit` (the default `editMenu` role), `Help`, and — on macOS — the app menu (`appMenu` role). The menu SHALL NOT include `View` or `Window` groups.

#### Scenario: Application menu is built at startup
- **WHEN** the app finishes starting
- **THEN** it SHALL call `Menu.setApplicationMenu` with a custom template
- **AND** that template SHALL contain a `File` menu with, in order: a `New` item (accelerator `CmdOrCtrl+N`), an `Open...` item (accelerator `CmdOrCtrl+O`), a `Save` item (accelerator `CmdOrCtrl+S`), a `Save As...` item (accelerator `CmdOrCtrl+Shift+S`), and finally a `Close` role on macOS or a `Quit` role elsewhere
- **AND** that template SHALL contain an `Edit` menu using the default `editMenu` role and a `Help` menu
- **AND**, on macOS, the template SHALL also include the `appMenu` role as its first entry
- **AND** the template SHALL NOT contain `View` or `Window` menu groups

## ADDED Requirements

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
