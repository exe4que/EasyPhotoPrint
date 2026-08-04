## Why

Saving and loading a project to/from disk is the last core gap blocking real use of Easy Photo Print — right now a project only ever lives in memory and disappears when the app closes. `fs:open-project`/`fs:save-project` are already scaffolded as stubs that throw "not implemented yet". This change makes them real, keeping the saved file as light as possible (no embedded image copies, no thumbnails — those already aren't copied today, and thumbnails are trivially regenerable from the source path).

## What Changes

- `File > Save` (`CmdOrCtrl+S`): first save on a project with no known file path opens the native save dialog (choose directory + filename); every subsequent save on that same project writes silently to the remembered path, no dialog, no confirmation.
- `File > Save As...` (`CmdOrCtrl+Shift+S`): always opens the native save dialog, writes a new file, and makes that new path the one `Save` will use from then on.
- `File > Open...` (`CmdOrCtrl+O`): same Main→Renderer confirm-before-discard pattern already used by `File > New` (no dirty-tracking exists, so any Open/New always confirms first) — on confirm, the renderer invokes the existing `fs.openProject()` IPC call, Main shows the native picker, reads and validates the file (`migrateProject`), regenerates each image's thumbnail from its saved path, and returns the project to the renderer, which replaces `document`/`imagePool`, clears undo/redo history, and remembers the opened path for subsequent `Save`s.
- Saved `.eppproj` files omit `thumbnailDataUrl` per image (the one part of `ImageAsset` that's genuinely heavy) — everything else in the schema is already lightweight metadata and paths.
- **Missing image detection and relink**: if an image's saved path can no longer be read at load time, the project still loads (that one asset is flagged `missing` instead of aborting the whole load) with a placeholder thumbnail. A dialog lists every missing asset with a "Locate..." action per row to relink it via a native file picker; assets left unresolved keep a persistent "Locate..." affordance on their Image Library card, and any canvas slot assigned to a `missing` asset renders visibly differently from an ordinary empty slot.
- No dirty-state tracking of any kind in this change — `Save` always writes, there is no "unsaved changes" indicator and no confirmation before losing in-memory work on `New`/`Open` beyond the confirmation dialog that already exists for `New`.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `project-persistence`: removes the "Disk Save and Load of Projects Are Not Implemented" requirement (no longer true) and adds the real save/open mechanism, the lightweight file shape, and the missing-image detection/relink/rendering behavior.
- `electron-shell`: the "Trimmed application menu" requirement's `File` submenu gains `Open...`, `Save`, and `Save As...`; a new requirement (mirroring the existing "File > New requests a renderer-side confirmation" one) documents the Main↔Renderer round trip for all three.

## Impact

- Affected code: `electron/main/ipc/fs.handlers.ts` (real save/open logic, replacing the stubs), `electron/main/menu.ts` (3 new menu items + accelerators), `electron/preload/index.ts` + `src/lib/ipc-client.ts` (typed IPC surface for save/open/relink, plus new menu-event subscriptions), `src/store/index.ts` (new `project: { filePath }` piece of state, outside `zundo`, and the actual save/open/relink orchestration since Main cannot read the Zustand store), `src/App.tsx` (subscribes to the new menu events, hosts the confirm-before-discard and missing-images dialogs), `src/components/panels/ImageLibraryPanel.tsx` (persistent "Locate..." affordance on missing cards), `src/components/canvas/PageStage.tsx` (distinct rendering for a slot assigned to a `missing` asset), `packages/layout-engine/src/types.ts` (`ImageAsset` gains an optional `missing?: boolean`).
- No changes to `packages/migrations` — `migrateProject` already validates the shape this change needs.
- No changes to how images are ingested from the library dialog or drag-and-drop; this only affects what happens to `imagePool` entries across a save/load round trip.
