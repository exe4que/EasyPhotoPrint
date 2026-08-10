## MODIFIED Requirements

### Requirement: Explicit contextBridge API surface
The renderer SHALL access filesystem, dialog, print, PDF, settings, template, image-decoding, and menu-event functionality exclusively through a single `window.eppAPI` object exposed via `contextBridge.exposeInMainWorld`, backed by explicitly named IPC channels invoked through `ipcMain.handle` — never through a generic/eval-style IPC channel.

#### Scenario: Renderer calls into Main only through window.eppAPI
- **WHEN** renderer code needs to open a file dialog, read/write a project, list/save/delete templates, read/write app settings, export a PDF, print a document, decode an already-known image file at a given size, or subscribe to menu events
- **THEN** it SHALL do so by calling a method on `window.eppAPI` (namespaced under `dialog`, `fs`, `images`, `menu`, `pdf`, `print`, `settings`, or `templates`)
- **AND** each of those methods SHALL correspond to a distinct, explicitly named IPC channel registered in the Main process with `ipcMain.handle`
