## Why

`.eppproj` files today reference images by absolute filesystem path (`ImageAsset.storedPath`/`originalPath`, both set to wherever the user originally picked the file, per `project-persistence`'s "no per-project asset copy step exists yet"). That model has two costs: a project isn't portable (move a photo, or move the project to another machine, and it's `missing`), and — the reason this matters now — it doesn't survive moving off the desktop filesystem at all. Android has no stable, re-openable path for a photo the user picked from their gallery (see the platform-adapter research this session's earlier conversation): a `content://` grant is not a path, can't be persisted indefinitely, and dies on reinstall.

Bundling each image's bytes into the `.eppproj` file itself collapses that into a single, platform-agnostic problem: read bytes once at ingest, embed them, done. No content-URI permission model, no per-page path resolution, no "missing" state caused by the user reorganizing their photo library. It also makes a project portable between machines and shareable as one file — a real desktop win independent of Android.

The app has not shipped yet, so this proposal does not preserve the old plain-JSON `.eppproj` format or migrate it. `.eppproj` simply becomes a different container going forward.

## What Changes

- **BREAKING**: `.eppproj` becomes a zip archive (`project.json` + one image file per pool entry at `images/<assetId>.<ext>`) instead of a plain JSON file. The old plain-JSON format is not read; there is no migration path.
- `ImageAsset.storedPath` changes meaning: it is no longer persisted in `project.json` at all, and at runtime it always points at a real, decodable file in the current session's **working directory** — a temp folder Main populates by copying bytes in at the moment they're needed (on ingest, or by extracting the archive on open) — never at the file the user originally picked, and never inside the archive itself. `ImageAsset.originalPath` keeps its existing shape but becomes purely a display-provenance label ("where this was first added from"); nothing reads it to locate pixels anymore.
- Ingesting images (`dialog:open-images`, and a relink) now copies each selected file's bytes into the working directory as part of ingestion, rather than merely recording where the OS file dialog pointed.
- `File > Save`/`Save As` zips the working directory's current bytes for every `imagePool` entry together with the project JSON, written atomically (temp file + rename) so a failed save can't corrupt the previous good file.
- `File > Open` extracts the chosen archive's images into a fresh working directory and points every asset's `storedPath` there; the "missing image" / relink flow is kept, but now triggers on a corrupted or unextractable *bundle entry* instead of an unreadable *external file path* — the same UI, a narrower and rarer cause.
- Because the container itself stops accepting anything but a zip, no pre-this-change `.eppproj` (plain JSON) can ever reach `migrateProject` again. That makes the "Migrating Legacy Per-Page Sheet Size" requirement (from the prior `document-level-sheet-size` change) describe behavior that can no longer trigger. It's removed here rather than left as dead spec, and `packages/migrations`' now-unreachable derive-from-first-page fallback is simplified accordingly.
- The working directory is recreated on `File > New`/`File > Open` and best-effort cleaned up on quit; leftover OS temp files from a crash are accepted as a low-cost, self-cleaning edge case rather than tracked and swept on next launch.
- New dependency: `fflate` (small, zero-dependency, works the same in Node and a browser/WebView — see design.md) for zip read/write in the Main process.
- `EppAPI` (`platform-adapter`) gains one additive method, `fs.resetWorkingStorage()`, so `File > New` can tell Main to discard the outgoing document's working-directory copies instead of letting them accumulate for the rest of the running session — a fire-and-forget call from the renderer's existing `startNewProject` action. This fits within `electron-shell`'s existing "Explicit contextBridge API surface" requirement (already generic about what lives under the `fs` namespace) and `platform-adapter`'s existing totality/single-contract requirements without needing a spec change to either capability.
- Explicitly unaffected otherwise: `pdf-lib`-based PDF composition, printing, image decode-at-size, the Image Library/canvas UI, and templates (`.epptemplate` files carry no image references and are untouched). None of these read `storedPath` any differently than they do today — they still get a real, on-disk path back; only where that path points, and its lifetime, changes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `project-persistence`: image ingestion, `File > Save`/`Save As`, `File > Open`, missing-image detection, and relinking all change to work through a bundled archive and a session-scoped working directory instead of external file-path references. The Purpose statement's "lightweight `.eppproj` file" framing goes stale and needs a manual edit at archive time (the delta format doesn't carry Purpose changes for an existing capability — see design.md).

## Impact

- `electron/main/ipc/fs.handlers.ts`: `OPEN_IMAGES_CHANNEL`/`RELINK_IMAGE_CHANNEL` copy into the working directory; `OPEN_PROJECT_CHANNEL`/`SAVE_PROJECT_CHANNEL` read/write a zip instead of a JSON file.
- `electron/main/ipc/fs.helpers.ts`: `assertPersistedImageAsset` stops requiring/reading `storedPath` from parsed JSON; `prepareProjectForSave` stops including it in the JSON payload it returns (image bytes travel as separate zip entries instead).
- New Main-process module(s) for working-directory lifecycle (create/recreate/cleanup) and archive read/write (see design.md for the split).
- `package.json`: adds `fflate` as a runtime dependency.
- No changes to `packages/layout-engine` (`ImageAsset`'s field shape is unchanged, only two fields' semantics), `packages/migrations` (`migrateProject`'s JSON-shape validation is unaffected — it's `fs.handlers.ts` that now hands it the unzipped `project.json`, not the raw file), `electron/main/pdf/**`, `electron/main/print-render/**`, `electron/main/ipc/print.handlers.ts`, `src/hooks/usePrintResolutionSrc.ts`, or any renderer UI component.
- `electron/main/ipc/fs.helpers.test.ts` updates for the `storedPath` removal from the persisted shape; new tests for the archive/working-directory helpers.
- `packages/migrations/src/index.ts`: `deriveSheetSize`'s "derive from the first page" fallback becomes unreachable (every project this app can still open always carries a top-level `sheetSize`) and is simplified to require the field rather than fall back; `packages/migrations/src/index.test.ts` drops the now-invalid legacy-derivation cases.
