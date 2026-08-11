## REMOVED Requirements

### Requirement: Trimmed application menu
**Reason**: The eight actions this menu exposed (New/Open/Save/Save As/Undo/Redo/Save Template/Save Template As) are now reachable through a single shared in-app toolbar component, used identically on every host. That toolbar was added by this same change once Android's lack of a native menu bar made "menu-only" access to these actions impossible on that host; keeping a redundant native menu alongside it on Electron would only maximize divergence between the two builds, the opposite of this change's goal.
**Migration**: None needed for users — every action the menu exposed is still available via the toolbar (now always visible at the top of the app window) and the same keyboard shortcuts (`CmdOrCtrl+N/O/S/Shift+S/Z/Shift+Z`), now handled in the renderer instead of bound to native menu items.

### Requirement: File > New requests a renderer-side confirmation before resetting state
**Reason**: Superseded by "New Requests a Confirmation Before Resetting State" — same required behavior, triggered by the toolbar instead of a menu click.
**Migration**: None — see the added requirement.

### Requirement: File > Open, Save, and Save As Round-Trip Through the Renderer
**Reason**: The Main→Renderer round-trip existed only because a native menu item runs in the Main process, which has no access to the renderer's store. The toolbar that now triggers these actions already runs in the renderer, so the round-trip has nothing left to do. Superseded by "Open, Save, and Save As Are Triggered Directly From the Renderer."
**Migration**: None — see the added requirement.

### Requirement: Edit > Undo and Redo Round-Trip Through the Renderer
**Reason**: Same reasoning as the Open/Save/Save As requirement above — no native menu item exists to round-trip from anymore. Superseded by "Undo and Redo Are Triggered Directly From the Renderer."
**Migration**: None — see the added requirement.

### Requirement: Edit > Save Template and Save Template As Round-Trip Through the Renderer
**Reason**: Same reasoning as the Open/Save/Save As requirement above. Superseded by "Save Template and Save Template As Are Triggered Directly From the Renderer."
**Migration**: None — see the added requirement.

## ADDED Requirements

### Requirement: No Custom Application Menu
The application SHALL NOT build a custom, app-specific application menu. On macOS, `Menu.setApplicationMenu` SHALL be called with only the OS-standard `appMenu` role (About/Hide/Services/Quit, etc. — platform convention, not an app-specific feature). On every other platform, the application SHALL run with no application menu bar at all (`Menu.setApplicationMenu(null)`). New/Open/Save/Save As/Undo/Redo/Save Template/Save Template As are reached exclusively through the in-app toolbar described by the `undo-redo` and `editor-layout` capabilities' toolbar requirements — the same toolbar component used on every host — not through any Electron-specific menu surface.

#### Scenario: No File/Edit/Help menu is built at startup
- **WHEN** the app finishes starting on any platform
- **THEN** it SHALL NOT construct a `File`, `Edit`, `View`, `Window`, or `Help` menu
- **AND** on macOS, the only menu present SHALL be the OS-standard `appMenu`
- **AND** on Windows/Linux, no application menu bar SHALL be present at all

#### Scenario: The toolbar is the only trigger for these actions on Electron
- **WHEN** the user wants to start a new project, open or save a project, undo/redo, or save a template, on the Electron host
- **THEN** they use the shared in-app toolbar — the same component and same code path used on every host

### Requirement: New Requests a Confirmation Before Resetting State
Activating the toolbar's `New` button SHALL NOT reset any application state immediately. The renderer SHALL require explicit user confirmation before discarding the current document.

#### Scenario: Activating New opens a confirmation dialog instead of resetting immediately
- **WHEN** the user activates the toolbar's `New` button (or its `CmdOrCtrl+N` keyboard shortcut)
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
- **THEN** the document, UI state, image pool, and undo/redo history SHALL remain exactly as they were before the toolbar button was activated

### Requirement: Open, Save, and Save As Are Triggered Directly From the Renderer
Because the toolbar that triggers these actions already runs in the renderer (unlike a native menu item, which would run in the Main process), activating `Open`, `Save`, or `Save As` on the toolbar SHALL invoke the corresponding store action directly — gathering current document/image-pool state and invoking the corresponding `EppAPI.fs` method itself — with no Main-process round-trip involved.

#### Scenario: Activating a toolbar button invokes the corresponding action directly
- **WHEN** the user activates the toolbar's `Open`, `Save`, or `Save As` button (or, on Electron, their `CmdOrCtrl+O`/`CmdOrCtrl+S`/`CmdOrCtrl+Shift+S` keyboard shortcuts)
- **THEN** the renderer SHALL invoke the corresponding action (open/save/save-as) directly, without any Main-process event round-trip

### Requirement: Undo and Redo Are Triggered Directly From the Renderer
Activating the toolbar's `Undo` or `Redo` button SHALL invoke the document undo/redo history directly from the renderer, with no Main-process round-trip involved.

#### Scenario: Activating a toolbar button invokes undo/redo directly
- **WHEN** the user activates the toolbar's `Undo` or `Redo` button (or, on Electron, its `CmdOrCtrl+Z`/`CmdOrCtrl+Shift+Z` keyboard shortcut)
- **THEN** the renderer SHALL invoke the same document undo/redo controls described by the `undo-redo` capability's "Undo and Redo Controls" requirement, directly, with no Main-process event round-trip
- **AND** if there is nothing to undo or redo, invoking it SHALL have no effect (the underlying history's own no-op behavior applies; the toolbar button itself is not disabled based on history state)

### Requirement: Save Template and Save Template As Are Triggered Directly From the Renderer
Activating the toolbar's `Save Template` or `Save Template As` button SHALL invoke the corresponding save flow directly from the renderer — exporting the active page's current structure and invoking `EppAPI.templates.save` itself — with no Main-process round-trip involved.

#### Scenario: Activating Save Template As always prompts for a name
- **WHEN** the user activates the toolbar's `Save Template As` button
- **THEN** it SHALL prompt the user for a template name and save the active page's current structure as a new template under that name

#### Scenario: Activating Save Template overwrites the linked template, or falls back to prompting for a name
- **WHEN** the user activates the toolbar's `Save Template` button and the active page is already linked to a template
- **THEN** it SHALL prompt for confirmation and overwrite that linked template with the page's current structure

#### Scenario: Save Template with no linked template behaves like Save Template As
- **WHEN** the user activates the toolbar's `Save Template` button and the active page is not linked to any template
- **THEN** it SHALL behave the same as activating `Save Template As` (prompt for a name and save as a new template) instead of having no effect

## MODIFIED Requirements

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
