## MODIFIED Requirements

### Requirement: Trimmed application menu
The application SHALL replace Electron's default application menu with a reduced menu template containing only `File` (with `New`, `Open...`, `Save`, `Save As...`, and a platform-appropriate `Close`/`Quit` item), `Edit` (a custom submenu with `Undo`, `Redo`, `Save Template`, and `Save Template As...` items — no browser-native editing roles), `Help`, and — on macOS — the app menu (`appMenu` role). The menu SHALL NOT include `View` or `Window` groups.

#### Scenario: Application menu is built at startup
- **WHEN** the app finishes starting
- **THEN** it SHALL call `Menu.setApplicationMenu` with a custom template
- **AND** that template SHALL contain a `File` menu with, in order: a `New` item (accelerator `CmdOrCtrl+N`), an `Open...` item (accelerator `CmdOrCtrl+O`), a `Save` item (accelerator `CmdOrCtrl+S`), a `Save As...` item (accelerator `CmdOrCtrl+Shift+S`), and finally a `Close` role on macOS or a `Quit` role elsewhere
- **AND** that template SHALL contain an `Edit` menu with, in order: an `Undo` item (accelerator `CmdOrCtrl+Z`), a `Redo` item (accelerator `CmdOrCtrl+Shift+Z`), a separator, a `Save Template` item, and a `Save Template As...` item, and a `Help` menu
- **AND**, on macOS, the template SHALL also include the `appMenu` role as its first entry
- **AND** the template SHALL NOT contain `View` or `Window` menu groups, nor any browser-native `Cut`, `Copy`, `Paste`, or `Select All` role

## ADDED Requirements

### Requirement: Edit > Save Template and Save Template As Round-Trip Through the Renderer
Because the Main process has no access to the renderer's Zustand store or the active page's template link, clicking `Edit > Save Template` or `Edit > Save Template As...` SHALL NOT perform any template data work directly in Main. Each SHALL send a distinct, payload-free menu event to the focused window's renderer (`menu:save-template`, `menu:save-template-as`), and the renderer SHALL be responsible for exporting the current page's structure and invoking the corresponding `window.eppAPI.templates.save` call itself. This mirrors the existing `menu:undo`/`menu:redo` pattern.

#### Scenario: Menu clicks notify the renderer without touching state
- **WHEN** the user clicks `Edit > Save Template` or `Edit > Save Template As...`
- **THEN** the Main process SHALL send the corresponding `menu:save-template` or `menu:save-template-as` event to the focused `BrowserWindow`'s renderer
- **AND** Main SHALL NOT read or modify any document, template, or UI state as part of handling the click

#### Scenario: Renderer subscribes to each event via a preload-exposed API
- **WHEN** the renderer app mounts
- **THEN** it SHALL subscribe to both menu events via `window.eppAPI.menu.onSaveTemplate(callback)` and `window.eppAPI.menu.onSaveTemplateAs(callback)`
- **AND** each subscription SHALL be implemented in the preload script by wrapping `ipcRenderer.on`/`ipcRenderer.removeListener`, the same pattern used for `onNewProject`
- **AND** calling the value returned by each subscription function SHALL unsubscribe that listener

#### Scenario: Receiving Save Template As always prompts for a name
- **WHEN** the renderer receives a `menu:save-template-as` event
- **THEN** it SHALL prompt the user for a template name and save the active page's current structure as a new template under that name, the same flow the former sidebar panel's "Save as…" button triggered

#### Scenario: Receiving Save Template overwrites the linked template, or falls back to prompting for a name
- **WHEN** the renderer receives a `menu:save-template` event and the active page is already linked to a template
- **THEN** it SHALL prompt for confirmation and overwrite that linked template with the page's current structure, the same flow the former sidebar panel's "Save" button triggered

#### Scenario: Save Template with no linked template behaves like Save Template As
- **WHEN** the renderer receives a `menu:save-template` event and the active page is not linked to any template
- **THEN** it SHALL behave the same as a `menu:save-template-as` event (prompt for a name and save as a new template) instead of having no effect
