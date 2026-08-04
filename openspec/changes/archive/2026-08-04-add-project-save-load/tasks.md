## 1. Schema and types

- [x] 1.1 Add optional `missing?: boolean` to `ImageAsset` in `packages/layout-engine/src/types.ts`
- [x] 1.2 Directly edit `openspec/specs/project-persistence/spec.md`'s `## Purpose` line after this change is archived — it currently states disk save/load is explicitly out of scope, which will no longer be true (the delta mechanism does not cover Purpose edits for an existing capability, see `openspec/changes/add-project-save-load/design.md`)

## 2. Main process: save, open, and relink IPC

- [x] 2.1 In `electron/main/ipc/fs.handlers.ts`, replace the `fs:save-project` stub: accept `(project: EPPProject, options: { forceDialog: boolean })`; if `forceDialog` or no remembered path is supplied, show `dialog.showSaveDialog` (default extension `.eppproj`); write `JSON.stringify(project, null, 2)` to the resolved path; return the resolved path (or `null` if canceled)
- [x] 2.2 Replace the `fs:open-project` stub: show `dialog.showOpenDialog` filtered to `.eppproj`; on cancel return `null`; on selection, read the file, `JSON.parse`, and run it through `migrateProject`; on parse/validation failure, reject with a clear error
- [x] 2.3 After validating, iterate `imagePool` and attempt to regenerate each entry's thumbnail from `originalPath` reusing the existing `createImageAssetFromPath`-style resize logic; on decode failure, keep the entry's persisted `widthPx`/`heightPx`/`fileName`/`originalPath`, set a placeholder `thumbnailDataUrl`, and set `missing: true` instead of throwing
- [x] 2.4 Add a new `dialog:relink-image` IPC channel: shows a native single-file picker (same image-format filters as `dialog:open-images`), and on selection re-runs the same ingestion logic (decode + resize) against the new path, returning the refreshed `originalPath`/`storedPath`/`widthPx`/`heightPx`/`thumbnailDataUrl` (or `null` if canceled)

## 3. Preload and IPC client typings

- [x] 3.1 Extend `electron/preload/index.ts`: `fs.saveProject(project, options)`, `fs.openProject()`, `dialog.relinkImage()`, and menu-event subscriptions `menu.onOpenProject`, `menu.onSaveProject`, `menu.onSaveProjectAs` (mirroring `onNewProject`'s `ipcRenderer.on`/`removeListener` wrapper)
- [x] 3.2 Update the `window.eppAPI` type surface in `src/lib/ipc-client.ts` to match

## 4. Menu wiring

- [x] 4.1 In `electron/main/menu.ts`, add `Open...` (`CmdOrCtrl+O`), `Save` (`CmdOrCtrl+S`), and `Save As...` (`CmdOrCtrl+Shift+S`) items to the `File` submenu, each sending its corresponding payload-free `menu:open-project` / `menu:save-project` / `menu:save-project-as` event to the focused window, per the `electron-shell` delta spec's ordering (`New`, `Open...`, `Save`, `Save As...`, then `Close`/`Quit`)

## 5. Store: project state and orchestration

- [x] 5.1 Add a new `project: { filePath: string | null }` slice/state to the store (outside `zundo`, sibling to `settings`)
- [x] 5.2 Add a `saveProject(forceDialog: boolean)` store action: gathers `{ schemaVersion, id, name, pages: document.pages, imagePool }` (stripping `thumbnailDataUrl` per asset and dropping any `missing` flag), calls `window.eppAPI.fs.saveProject(project, { forceDialog: forceDialog || project.filePath == null })`, and on a non-null resolved path updates `project.filePath`
- [x] 5.3 Add an `openProject()` store action: calls `window.eppAPI.fs.openProject()`; on a non-null result, replaces `document.pages` and `imagePool`, clears undo/redo history (`useEPPStore.temporal.getState().clear()`), and sets `project.filePath` to the opened path
- [x] 5.4 Add a `relinkImage(imageAssetId: string)` store action: calls `window.eppAPI.dialog.relinkImage()`; on a non-null result, updates that `ImageAsset`'s `originalPath`/`storedPath`/`widthPx`/`heightPx`/`thumbnailDataUrl` in `imagePool` and clears its `missing` flag
- [x] 5.5 Extend `startNewProject()` (`src/store/index.ts`) to also reset `project.filePath` to `null`

## 6. UI: menu event wiring and dialogs

- [x] 6.1 In `src/App.tsx`, subscribe to `onOpenProject` (show the existing "discard changes?" confirm pattern reused/adapted from `New`'s dialog copy; on confirm call `openProject()`), `onSaveProject` (call `saveProject(false)` directly, no dialog), and `onSaveProjectAs` (call `saveProject(true)` directly)
- [x] 6.2 After a successful `openProject()`, if the resulting `imagePool` contains any `missing: true` entries, open a new relink dialog built on `ConfirmDialog` (via its `children` slot): one row per missing asset with a "Locate..." button wired to `relinkImage(assetId)`, and a single "Done" button to close

## 7. UI: persistent relink affordance and missing-slot rendering

- [x] 7.1 In `src/components/panels/ImageLibraryPanel.tsx`, show a "Missing" badge + "Locate..." button on any card whose asset has `missing: true`, wired to the same `relinkImage(assetId)` action
- [x] 7.2 In `src/components/canvas/PageStage.tsx` (and `FreeformElement.tsx` for freeform-placed images), render a distinct "missing image" state for any slot/element whose assigned `ImageAsset` has `missing: true`, instead of the ordinary image or empty-slot placeholder

## 8. Tests

- [x] 8.1 Unit tests for the new store actions (`saveProject` path-remembering behavior across first-save vs subsequent-save vs Save As, `openProject` replacing state and clearing history, `relinkImage` updating the right asset without touching others)
- [x] 8.2 Unit test (or Main-process-level test) for the missing-image detection path in `fs.handlers.ts`'s open logic: one bad path among several good ones still yields a fully loaded project with exactly that one entry marked `missing`

## 9. Verify

- [x] 9.1 `npm run typecheck`
- [x] 9.2 `npm run test`
- [x] 9.3 Manually verify in the running app: first Save prompts for a path and subsequent Saves don't; Save As always prompts and redirects future Saves to the new path; Open confirms first, then loads a saved file correctly; a project referencing a since-deleted/renamed image file still loads with that asset marked missing, shows the relink dialog, and "Locate..." successfully repairs it both from that dialog and later from the Image Library panel
