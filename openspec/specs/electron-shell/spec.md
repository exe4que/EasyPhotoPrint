# electron-shell Specification

## Purpose
The electron-shell capability defines how Easy Photo Print's Electron process architecture keeps the renderer sandboxed from Node.js and the filesystem, and confirms the app builds no custom native application menu on this host — New/Open/Save/Save As/Undo/Redo/Save Template/Save Template As are all reached through the shared in-app `File`/`Edit` menu bar described by the `undo-redo` and `editor-layout` capabilities (the same component the `android-shell` capability's host uses too), never a Main-process-built native menu.
## Requirements
### Requirement: Renderer process isolation
The application SHALL create its `BrowserWindow` with `contextIsolation` enabled, `nodeIntegration` disabled, and `sandbox` enabled, so the renderer has no direct access to Node.js APIs.

#### Scenario: Main window is created with a locked-down webPreferences configuration
- **WHEN** the app finishes starting and creates its main window
- **THEN** the window's `webPreferences` SHALL have `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`

### Requirement: Explicit contextBridge API surface
On the Electron host, filesystem, dialog, print, PDF, settings, template, and image-decoding functionality SHALL be reachable in the renderer exclusively through a single `window.eppAPI` object exposed via `contextBridge.exposeInMainWorld`, backed by explicitly named IPC channels invoked through `ipcMain.handle` — never through a generic/eval-style IPC channel. Shared renderer code SHALL NOT read `window.eppAPI` itself; it reaches these capabilities through the registered platform adapter (per the `platform-adapter` capability), and the Electron adapter is the only place that binds to `window.eppAPI`.

#### Scenario: Renderer calls into Main only through window.eppAPI
- **WHEN** renderer code needs to open a file dialog, read/write a project, list/save/delete templates, read/write app settings, export a PDF, print a document, or decode an already-known image file at a given size
- **THEN** the call SHALL reach Main by way of a method on `window.eppAPI` (namespaced under `dialog`, `fs`, `images`, `pdf`, `print`, `settings`, or `templates`)
- **AND** each of those methods SHALL correspond to a distinct, explicitly named IPC channel registered in the Main process with `ipcMain.handle`

#### Scenario: Only the Electron adapter binds to window.eppAPI
- **WHEN** the application starts on the Electron host
- **THEN** the Electron entry point SHALL register an adapter backed by `window.eppAPI`
- **AND** `window.eppAPI` SHALL NOT be referenced anywhere else in shared renderer code

#### Scenario: A missing preload surface is reported clearly
- **WHEN** the Electron adapter is constructed and `window.eppAPI` is absent
- **THEN** it SHALL fail with an error identifying the missing Electron preload surface, rather than registering an adapter whose members throw later on first use

### Requirement: No Custom Application Menu
The application SHALL NOT build a custom, app-specific *native* application menu. On macOS, `Menu.setApplicationMenu` SHALL be called with only the OS-standard `appMenu` role (About/Hide/Services/Quit, etc. — platform convention, not an app-specific feature). On every other platform, the application SHALL run with no native application menu bar at all (`Menu.setApplicationMenu(null)`). New/Open/Save/Save As/Undo/Redo/Save Template/Save Template As are reached exclusively through the in-app `File`/`Edit` menu bar described by the `undo-redo` and `editor-layout` capabilities' requirements — a renderer-drawn component that mimics a native menu's appearance without being one, the same on every host — not through any Electron-specific native menu surface.

#### Scenario: No native File/Edit/Help menu is built at startup
- **WHEN** the app finishes starting on any platform
- **THEN** it SHALL NOT construct a native `File`, `Edit`, `View`, `Window`, or `Help` menu
- **AND** on macOS, the only native menu present SHALL be the OS-standard `appMenu`
- **AND** on Windows/Linux, no native application menu bar SHALL be present at all

#### Scenario: The in-app menu bar is the only trigger for these actions on Electron
- **WHEN** the user wants to start a new project, open or save a project, undo/redo, or save a template, on the Electron host
- **THEN** they use the shared in-app `File`/`Edit` menu bar — the same component and same code path used on every host, not a native OS menu

### Requirement: New Requests a Confirmation Before Resetting State
Activating `New` in the in-app `File` menu SHALL NOT reset any application state immediately. The renderer SHALL require explicit user confirmation before discarding the current document.

#### Scenario: Activating New opens a confirmation dialog instead of resetting immediately
- **WHEN** the user activates `New` in the `File` menu (or its `CmdOrCtrl+N` keyboard shortcut)
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
- **THEN** the document, UI state, image pool, and undo/redo history SHALL remain exactly as they were before the menu item was activated

### Requirement: Open, Save, and Save As Are Triggered Directly From the Renderer
Because the in-app `File` menu that triggers these actions already runs in the renderer (unlike a native menu item, which would run in the Main process), activating `Open`, `Save`, or `Save As` SHALL invoke the corresponding store action directly — gathering current document/image-pool state and invoking the corresponding `EppAPI.fs` method itself — with no Main-process round-trip involved.

#### Scenario: Activating a File menu item invokes the corresponding action directly
- **WHEN** the user activates `Open`, `Save`, or `Save As` in the `File` menu (or, on Electron, their `CmdOrCtrl+O`/`CmdOrCtrl+S`/`CmdOrCtrl+Shift+S` keyboard shortcuts)
- **THEN** the renderer SHALL invoke the corresponding action (open/save/save-as) directly, without any Main-process event round-trip

### Requirement: Undo and Redo Are Triggered Directly From the Renderer
Activating `Undo` or `Redo` in the in-app `Edit` menu SHALL invoke the document undo/redo history directly from the renderer, with no Main-process round-trip involved.

#### Scenario: Activating an Edit menu item invokes undo/redo directly
- **WHEN** the user activates `Undo` or `Redo` in the `Edit` menu (or, on Electron, its `CmdOrCtrl+Z`/`CmdOrCtrl+Shift+Z` keyboard shortcut)
- **THEN** the renderer SHALL invoke the same document undo/redo controls described by the `undo-redo` capability's "Undo and Redo Controls" requirement, directly, with no Main-process event round-trip
- **AND** if there is nothing to undo or redo, invoking it SHALL have no effect (the underlying history's own no-op behavior applies; the menu item itself is not disabled based on history state)

### Requirement: Save Template and Save Template As Are Triggered Directly From the Renderer
Activating `Save Template` or `Save Template As` in the in-app `Edit` menu SHALL invoke the corresponding save flow directly from the renderer — exporting the active page's current structure and invoking `EppAPI.templates.save` itself — with no Main-process round-trip involved.

#### Scenario: Activating Save Template As always prompts for a name
- **WHEN** the user activates `Save Template As` in the `Edit` menu
- **THEN** it SHALL prompt the user for a template name and save the active page's current structure as a new template under that name

#### Scenario: Activating Save Template overwrites the linked template, or falls back to prompting for a name
- **WHEN** the user activates `Save Template` in the `Edit` menu and the active page is already linked to a template
- **THEN** it SHALL prompt for confirmation and overwrite that linked template with the page's current structure

#### Scenario: Save Template with no linked template behaves like Save Template As
- **WHEN** the user activates `Save Template` in the `Edit` menu and the active page is not linked to any template
- **THEN** it SHALL behave the same as activating `Save Template As` (prompt for a name and save as a new template) instead of having no effect
