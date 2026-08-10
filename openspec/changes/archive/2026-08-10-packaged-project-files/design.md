## Context

Today `ImageAsset.storedPath`/`originalPath` are both set to wherever the OS file dialog pointed at ingest time (`fs.handlers.ts`'s `createImageAssetFromPath`), and every pixel read — `composeProjectPdf.ts`'s `nativeImage.createFromPath(spec.asset.storedPath)`, `usePrintResolutionSrc.ts`'s `images.decodeAtSize(asset.storedPath, ...)`, and `fs.handlers.ts`'s own thumbnail/decode helpers — reads directly from that path. `project-persistence`'s own spec already flags this as provisional: `storedPath`'s doc comment says "both set to the source file's path today, since no per-project asset copy step exists yet." This change completes that design rather than reversing a settled one. See proposal.md - Why for the motivation (portability, and the Android content-URI problem this collapses).

## Goals / Non-Goals

**Goals:**
- `.eppproj` becomes fully self-contained: every image's bytes travel with the file.
- Every existing pixel-reading code path (`composeProjectPdf.ts`, `usePrintResolutionSrc.ts`, `images:decode-at-size`, the thumbnail/decode helpers in `fs.handlers.ts`) keeps working completely unchanged — `storedPath` stays "a real file Main can read right now," only where it points changes.
- No legacy format support and no migration — the app hasn't shipped, so `.eppproj` simply becomes a zip going forward.

**Non-Goals:**
- Not touching `pdf-lib` PDF composition, printing, or `packages/layout-engine`/`packages/migrations` — this is confined to the ingest/save/open boundary.
- Not building a robust crash-recovery system for orphaned temp directories (see Decision 4).
- Not deduplicating identical images across projects, or incremental/diff-based re-zipping on save — every save re-reads and re-embeds every pool entry's current working-directory bytes. Simple and correct first; revisit only if save latency on a real large project turns out to matter.

## Decisions

### 1. Copy at ingest, not at save

Every image gets copied into a session-scoped **working directory** (`<os temp>/easy-photo-print-<sessionId>/images/<assetId>.<ext>`) the moment it enters the pool — via `dialog:open-images`, via a relink, or via extracting an opened archive — rather than only at save time.

Copying at ingest means `storedPath` is *always* a working-directory file from the instant an asset exists, with exactly one code path producing that guarantee (ingest and open both funnel through it), instead of two: an ingest-time "reference the original" state and a separate save-time "now copy it" state. That symmetry is what keeps the change small — `composeProjectPdf.ts` and friends never need to know or care whether a given `storedPath` came from an ingest or an open.

The alternative — reference the original file during editing, copy only at save — was considered and rejected: it reintroduces exactly the failure mode this change exists to remove (the user deletes or moves the source photo between ingesting it and saving, and the save silently can't find it), and it would require `fs:save-project`'s IPC response to hand back updated `storedPath` values so the renderer's `imagePool` stays in sync — a contract change that copy-at-ingest avoids entirely. `fs:save-project` keeps its existing `Promise<string | null>` shape; `fs:open-project` keeps its existing `{ project; filePath } | null` shape. Neither the `EppAPI` contract nor any renderer store code needs to change.

### 2. `fflate` for zip read/write

Chosen for three things together: zero dependencies, a synchronous API (`zipSync`/`unzipSync`) that fits Main's existing synchronous-feeling `nativeImage.createFromPath` style of code better than a callback/stream API, and — not needed by this change but relevant to the plan this is one phase of — it runs identically in Node and a browser/WebView, so a later Android adapter reads the same container format with the same library rather than needing a second implementation.

Alternatives: `adm-zip` is Node-only (irrelevant to the point above, and a heavier, less actively maintained dependency for what's a small amount of surface here); `yazl`/`yauzl` are lower-level (separate writer/reader, stream-based, more code for the same result); `JSZip` is heavier and its ergonomics lean toward browser use-cases this Main-process code doesn't need.

### 3. `storedPath` is never persisted; the zip entry name carries identity instead

`prepareProjectForSave` stops writing `storedPath` into `project.json`, and `assertPersistedImageAsset` stops requiring it when reading one back. A working-directory path is only ever meaningful for the process that created it — persisting it would be actively misleading (it won't exist on next launch, let alone on another machine).

Each pool entry's bytes are embedded at `images/<assetId>.<ext>`, where `<ext>` is derived from the already-persisted `fileName` field. The asset's own `id` — already required, already stable — is what ties a `project.json` pool entry to its archive entry; no separate path field is needed on either side of the read/write. This removes a field from the persisted shape rather than adding one.

`originalPath` keeps its existing field and type — it's cheap to keep and may be worth surfacing later (e.g. "originally added from vacation-photos/img_004.jpg") — but this change downgrades what it's *for*: display-only provenance, never dereferenced for pixels. Nothing in the current UI shows it today, so this is a documentation/behavior change, not a UI change.

### 4. Working-directory lifecycle: session-scoped, best-effort cleanup, no crash registry

One working directory exists per running app instance. It's created lazily on first need, replaced (old one best-effort deleted, fresh one created) on `File > New` and `File > Open`, and best-effort deleted on app quit (`before-quit`).

A crash or force-quit before that cleanup runs leaves an orphaned OS temp directory. This is accepted deliberately rather than solved: OS temp directories are already routinely cleaned by the platform (Windows Disk Cleanup, systemd-tmpfiles, macOS periodic purge), the absolute cost of one leftover folder of copied photos is small, and building a "scan for and sweep orphaned working directories on next launch" system is real complexity — file locking questions, "is another instance of the app still using this one," cross-platform temp-dir enumeration — for a problem the OS already mostly handles. Revisit only if this proves to actually bother users in practice.

### 5. Missing/relink is kept, repurposed to a narrower cause

The existing "missing image" detection and relink UI (dialog on open, persistent "Locate..." on the Image Library card) stay exactly as they are UX-wise. What changes is only the trigger: today it fires when `originalPath` can't be read from disk (the user moved/renamed/deleted the source file); after this change there is no `originalPath`-based read at all, so it instead fires when a specific archive entry fails to extract or decode (a corrupted or truncated `.eppproj`, a damaged zip entry). Relinking still works identically — the newly picked replacement file goes through the same ingest-copy path as a fresh image (Decision 1), so it's correctly embedded on the next save.

This is a real, if much narrower, ongoing failure mode independent of the "no legacy support" simplification the proposal takes elsewhere — a corrupted archive is a data-integrity concern, not a backward-compatibility one — so it's kept rather than removed. Flagging this explicitly: if the added complexity of keeping a whole relink subsystem alive for what should now be a rare case isn't worth it, dropping it is a reasonable simplification to make instead — this is a judgment call, not a settled requirement, and easy to revisit.

### 6. Atomic save via temp-file-then-rename

`fs:save-project` builds the full zip in memory (or to a temp file in the same directory as the target), then renames it over the target path, rather than writing the target path directly. A `rename()` within the same directory/volume is atomic on both the filesystems this app targets, so a save that fails partway through (disk full, process killed) can't leave a truncated, unopenable `.eppproj` in place of a previously-good one. This replaces today's direct `writeFile(targetPath, ...)`.

## Risks / Trade-offs

- [Saving a project with many/large photos re-embeds every one of them on every save, not just changed ones] → Accepted per Non-Goals; typical project sizes here (a few dozen photos for a print layout) make this a non-issue, and it's the simplest correct thing to build first.
- [Disk usage: a project's images now exist in the working directory *and* inside the saved archive] → Same order of magnitude as any document-editing app that keeps a live working copy (e.g. a `.docx` open in an editor); acceptable for a desktop photo-layout tool.
- [The Purpose line in `project-persistence`'s archived spec calls `.eppproj` "a lightweight `.eppproj` file," which stops being accurate] → The delta-spec sync tool ignores a `## Purpose` section on a delta for an existing capability (only used to seed a *new* capability's main spec), so this can't be fixed through the normal archive flow. Flagging it here so it gets a manual one-line edit to `openspec/specs/project-persistence/spec.md`'s Purpose at archive time instead of silently going stale.

## Migration Plan

None — the app hasn't shipped, and the proposal explicitly does not preserve or migrate the old plain-JSON `.eppproj` format. Any `.eppproj` file that predates this change simply fails to open (it isn't a valid zip); there is no dual-read fallback to maintain.
