## 1. Dependency

- [x] 1.1 Add `fflate` to `package.json` `dependencies` (used only from `electron/main/**`; not bundled into the renderer).

## 2. Working directory lifecycle

- [x] 2.1 Created `electron/main/workingDirectory.ts`: a module-level session id (`crypto.randomUUID()` at load time), `getWorkingImagesDir(): Promise<string>` (async, not sync as originally sketched — it needs to `mkdir` lazily, and every call site is already inside an async IPC handler) that lazily creates and returns `<app.getPath('temp')>/easy-photo-print-<sessionId>/images`, and `resetWorkingDirectory(): Promise<string>` that best-effort removes the current directory, regenerates the session id, creates a fresh one, and returns the new images dir.
- [x] 2.2 Registered `app.on('before-quit', ...)` in `electron/main/index.ts` to best-effort (fire-and-forget) remove the current working directory.

## 3. Archive read/write helpers

- [x] 3.1 Created `electron/main/projectBundle.ts` using `fflate`'s synchronous `zipSync`/`unzipSync`, wrapped in async functions (file I/O is naturally async):
  - `buildProjectBundle(projectJson: unknown, images: BundleImageSource[]): Promise<Uint8Array>` — reads each image's current bytes off disk, zips them alongside a `project.json` entry.
  - `extractProjectBundle(zipBytes: Uint8Array, destImagesDir: string): Promise<unknown>` — throws a clear error if the archive isn't a valid zip or has no parseable `project.json` entry (the "invalid or unreadable file" failure), and best-effort writes every `images/*` entry found to `destImagesDir` (a per-entry write failure is swallowed here — the existing decode-failure catch in `regenerateImageAsset`, task 4.4, is what turns a missing/corrupted extracted file into `missing: true`, not this function). Returns the parsed `project.json` value.
- [x] 3.2 Unit tested `projectBundle.ts` against real temp files (5 tests): round-trip (build then extract, bytes and JSON match), correct per-asset-id entry naming, missing/unparseable `project.json` throws, invalid zip bytes throws, and a readable image extracts even when demonstrating that only `project.json`'s presence/parseability gates the whole open.

## 4. Ingestion, relink, and open/save handlers

- [x] 4.1 In `electron/main/ipc/fs.handlers.ts`, `createImageAssetFromPath(filePath)` now generates the asset id first, copies `filePath`'s bytes into the working directory as `<id><ext>`, decodes dimensions/thumbnail from that copy (not the original), and returns an `ImageAsset` with `storedPath` set to the copy and `originalPath` set to the original `filePath`. `OPEN_IMAGES_CHANNEL` and `RELINK_IMAGE_CHANNEL` both call it (now `await`ed / `Promise.all`-mapped, since it's async).
- [x] 4.2 Added the `fs:reset-working-storage` IPC channel and `fs.resetWorkingStorage: () => Promise<void>` on `EppAPI` (`src/lib/platform/contract.ts`) plus `electron/preload/index.ts`. `electronAdapter.ts` needed no change — it's a pure pass-through of `window.eppAPI`.
- [x] 4.3 `src/store/index.ts`'s `startNewProject` now calls `getEppApi().fs.resetWorkingStorage()` fire-and-forget after the synchronous state reset.
- [x] 4.4 Reworked `OPEN_PROJECT_CHANNEL`: reads raw bytes, calls `resetWorkingDirectory()` for a fresh images dir, `extractProjectBundle(...)` (wrapped to prefix the filename onto any thrown error, matching the old error's style) replaces the old `readFile(utf8)` + `JSON.parse`. `regenerateImageAsset` now takes `(persisted, imagesDir)`, decodes from `<imagesDir>/<id><ext>`, and attaches `storedPath` itself after calling the unchanged pure `applyRegeneratedImage` helper (which no longer knows about `storedPath` at all, since `PersistedImageAsset` drops it in task 5.1).
- [x] 4.5 Reworked `SAVE_PROJECT_CHANNEL`: builds the `images` list from `project.imagePool` (`assetId`/`ext` from `fileName`/`filePath: storedPath`), calls `buildProjectBundle(...)` (errors wrapped with a "Could not save the project" prefix), writes to `<targetPath>.tmp-<uuid>` then `rename`s over `targetPath`, cleaning up the temp file on failure.

## 5. Persisted shape

- [x] 5.1 In `electron/main/ipc/fs.helpers.ts`: `assertPersistedImageAsset` stops requiring/reading `storedPath`; `PersistedImageAsset` narrows accordingly. `prepareProjectForSave` stops including `storedPath`. `applyRegeneratedImage`'s return type narrows from `ImageAsset` to `Omit<ImageAsset, 'storedPath'>` (it no longer has enough information to produce a full `ImageAsset` — attaching `storedPath` is now the caller's job, per task 4.4's `regenerateImageAsset`).
- [x] 5.2 Updated `electron/main/ipc/fs.helpers.test.ts`: `persistedAsset()` fixture drops `storedPath`; "validates a well-formed project document" and "prepareProjectForSave" tests updated accordingly (the latter now explicitly adds `storedPath` to its *input* literal, since that's what the function is stripping).

## 6. Retire the dead legacy sheet-size migration

- [x] 6.1 In `packages/migrations/src/index.ts`: removed `deriveSheetSize` and `DEFAULT_SHEET_SIZE` entirely — `migrateProject` now does `assertRecord(record.sheetSize, 'project.sheetSize')` directly, throwing otherwise.
- [x] 6.2 Updated `packages/migrations/src/index.test.ts`: removed the three legacy-derivation cases; added "rejects a project with no top-level sheetSize".
- [x] 6.3 Removed `electron/main/ipc/fs.helpers.test.ts`'s "derives sheetSize from the first page for a legacy document" case.

## 7. Verification

- [x] 7.1 Ran the full test suite and typecheck. Also fixed a gap the changes exposed: `startNewProject` now fire-and-forgets `fs.resetWorkingStorage()`, but several `src/store/index.test.ts` describe blocks call `startNewProject()` in `afterEach` without ever registering a platform adapter. Registered a default fake adapter (via the existing `installMockEppApi({})`) at module scope so every test in the file starts with a working stub, and added `resetWorkingStorage` to `installMockEppApi`'s fixed (non-overridable) defaults.
- [x] 7.2 Verified end-to-end across two separate Electron processes (Playwright `_electron` under xvfb, native dialogs stubbed): (1) Load Images copies the picked file into a session working directory immediately (confirmed by listing the OS temp dir); (2) deleted the original source photo from disk, then Export PDF still succeeded (`%PDF-` header) — proves nothing depends on the original file past ingest; (3) `File > Save` wrote a real zip archive (`PK` magic bytes); (4) `File > New` responded immediately (not blocked by the fire-and-forget reset) and, after a short wait, the old session's working directory was gone and a fresh empty one existed in its place, while unrelated stray directories were left untouched; (5) closed that process entirely and launched a **fresh** one, opened the saved project, and the image reappeared with no "missing images" dialog and a correct thumbnail, and Export PDF from that freshly-opened project succeeded too — confirming the full save → close → reopen round-trip works with the original source file long gone.
- [x] 7.3 Ran `openspec validate --strict --changes packaged-project-files` — passes.
