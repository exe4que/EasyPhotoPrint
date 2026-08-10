## MODIFIED Requirements

### Requirement: Explicit contextBridge API surface
On the Electron host, filesystem, dialog, print, PDF, settings, template, image-decoding, and menu-event functionality SHALL be reachable in the renderer exclusively through a single `window.eppAPI` object exposed via `contextBridge.exposeInMainWorld`, backed by explicitly named IPC channels invoked through `ipcMain.handle` — never through a generic/eval-style IPC channel. Shared renderer code SHALL NOT read `window.eppAPI` itself; it reaches these capabilities through the registered platform adapter (per the `platform-adapter` capability), and the Electron adapter is the only place that binds to `window.eppAPI`.

#### Scenario: Renderer calls into Main only through window.eppAPI
- **WHEN** renderer code needs to open a file dialog, read/write a project, list/save/delete templates, read/write app settings, export a PDF, print a document, decode an already-known image file at a given size, or subscribe to menu events
- **THEN** the call SHALL reach Main by way of a method on `window.eppAPI` (namespaced under `dialog`, `fs`, `images`, `menu`, `pdf`, `print`, `settings`, or `templates`)
- **AND** each of those methods SHALL correspond to a distinct, explicitly named IPC channel registered in the Main process with `ipcMain.handle`

#### Scenario: Only the Electron adapter binds to window.eppAPI
- **WHEN** the application starts on the Electron host
- **THEN** the Electron entry point SHALL register an adapter backed by `window.eppAPI`
- **AND** `window.eppAPI` SHALL NOT be referenced anywhere else in shared renderer code

#### Scenario: A missing preload surface is reported clearly
- **WHEN** the Electron adapter is constructed and `window.eppAPI` is absent
- **THEN** it SHALL fail with an error identifying the missing Electron preload surface, rather than registering an adapter whose members throw later on first use
