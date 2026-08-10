## MODIFIED Requirements

### Requirement: Native Image Ingestion Dialog
The system SHALL provide a native "open file" dialog (invoked via the `dialog:open-images` IPC channel) that lets the user select one or more image files, filtered to common raster formats (`png`, `jpg`, `jpeg`, `webp`, `gif`, `bmp`, `tiff`). For each selected file, the Main process SHALL copy its bytes into the project's working directory, read its pixel dimensions, and generate a downscaled thumbnail whose longer edge does not exceed 240px, encoded as a data URL, and return one `ImageAsset` per selected file to the renderer, which SHALL append them to the in-memory `imagePool`. Each returned asset's `storedPath` SHALL point at its working-directory copy, not at the originally selected file.

#### Scenario: Selecting images adds them to the pool
- **WHEN** the user clicks "Load images" and selects one or more files in the native dialog
- **THEN** each selected file SHALL produce a new `ImageAsset` (with a fresh `id`, decoded `widthPx`/`heightPx`, and a `thumbnailDataUrl`) appended to the store's `imagePool`, without removing any previously loaded assets
- **AND** each asset's `storedPath` SHALL be a working-directory copy of the selected file, not the file's original location

#### Scenario: Canceling the dialog leaves the pool unchanged
- **WHEN** the user opens the native "open file" dialog and cancels it without selecting any file
- **THEN** the `imagePool` SHALL remain exactly as it was before the dialog was opened

#### Scenario: Thumbnail is downscaled to a bounded edge
- **WHEN** an image whose longer edge exceeds 240px is ingested
- **THEN** the generated `thumbnailDataUrl` SHALL represent an image resized so its longer edge is at most 240px, preserving its original aspect ratio

#### Scenario: Undecodable image is rejected
- **WHEN** a selected file cannot be decoded (its reported width or height is zero or negative)
- **THEN** the ingestion for that file SHALL fail with an error instead of producing a malformed `ImageAsset`

### Requirement: ImageAsset Data Shape
Every `ImageAsset` SHALL include a UUID `id`, a `fileName`, integer `widthPx`/`heightPx`, a `thumbnailDataUrl`, an `originalPath` (the location the file was first picked from, kept only as a display-provenance label — nothing reads it to locate pixels), and a `storedPath` that always points at a real, decodable file in the current session's working directory. `storedPath` SHALL NOT be persisted in a saved project's `project.json`; it SHALL be recomputed fresh every time the process needs it (by ingestion, or by extracting an opened archive — see "Project Working Storage Is Session-Scoped, Not Persisted").

#### Scenario: Ingested asset has stable identity and file metadata
- **WHEN** an image file is ingested through the native dialog
- **THEN** the resulting `ImageAsset` SHALL have a unique `id`, `fileName` set to the file's base name, `originalPath` set to the file's original filesystem location, and `storedPath` set to its working-directory copy (a different path from `originalPath`)

### Requirement: File > Open Restores a Saved Project
`File > Open...` SHALL follow the same Main→Renderer confirmation pattern as `File > New`: the renderer SHALL request confirmation before discarding the current in-memory document, and only after the user confirms SHALL it invoke the `fs:open-project` IPC channel, which SHALL show the native open dialog scoped to `.eppproj` files, read the chosen file as a zip archive, extract its `project.json` entry and validate it (via the existing `migrateProject` structural validation), extract its image entries into a fresh working directory, and return the resulting project — with every `imagePool` entry's `storedPath` pointing at its extracted copy — to the renderer. Applying the returned project SHALL replace `document.pages` and `imagePool`, clear the undo/redo history, and remember the opened file's path so subsequent `File > Save` calls write to it silently.

#### Scenario: Opening a project requires confirmation first
- **WHEN** the user triggers `File > Open...`
- **THEN** the renderer SHALL show a confirmation dialog before doing anything else
- **AND** only on confirmation SHALL it invoke the open-project IPC call

#### Scenario: Canceling the native picker leaves the current project untouched
- **WHEN** the user confirms discarding the current document but then cancels the native file picker
- **THEN** `document.pages`, `imagePool`, and the undo/redo history SHALL remain exactly as they were before `File > Open...` was triggered

#### Scenario: Opening a valid file replaces the document and clears history
- **WHEN** a chosen `.eppproj` archive is read and its `project.json` entry passes `migrateProject` validation
- **THEN** `document.pages` and `imagePool` SHALL be replaced with the file's contents
- **AND** the undo/redo history SHALL be cleared so the previous project cannot be restored via undo
- **AND** the opened file's path SHALL become the project's remembered path for subsequent `File > Save` calls

#### Scenario: An invalid or unreadable file is rejected without touching current state
- **WHEN** the chosen file cannot be read as a valid zip archive, is missing its `project.json` entry, or that entry fails `migrateProject` validation
- **THEN** the open SHALL fail with an error shown to the user
- **AND** `document.pages`, `imagePool`, and the undo/redo history SHALL remain exactly as they were before the open was attempted

### Requirement: Missing Image Detection on Project Open
While opening a project, for each `imagePool` entry the Main process SHALL attempt to extract that entry's image bytes from the archive and regenerate a thumbnail from them. If that entry cannot be extracted or decoded (a corrupted or missing bundle entry), the asset SHALL be marked `missing: true` and given a placeholder thumbnail instead of aborting the whole open; its `widthPx`/`heightPx` SHALL be taken from the saved `project.json` rather than re-derived, since they do not require the image bytes to be readable. A project whose `imagePool` contains one or more `missing` entries SHALL still load successfully.

#### Scenario: One missing image does not block the rest of the project from loading
- **WHEN** a project is opened and one of its `imagePool` entries' image bytes cannot be extracted or decoded from the archive
- **THEN** the project SHALL still finish loading with all its pages and other images intact
- **AND** that one entry SHALL have `missing: true` and a placeholder thumbnail
- **AND** that entry's `widthPx`/`heightPx` SHALL match the values stored in `project.json`, not be re-derived

#### Scenario: A successfully extracted image is not marked missing
- **WHEN** a project is opened and an `imagePool` entry's image bytes extract and decode successfully
- **THEN** that entry's thumbnail SHALL be regenerated from the extracted copy and it SHALL NOT be marked `missing`

### Requirement: Relinking a Missing Image
The user SHALL be able to relink any `imageAsset` marked `missing` to a new file via a native single-file picker, both immediately after opening a project with missing images (via a dialog listing every missing asset with a per-row "Locate..." action) and at any later time (via a persistent "Locate..." affordance on that asset's card in the Image Library panel). Relinking SHALL copy the newly chosen file's bytes into the project's working directory — the same as a fresh ingestion — and re-derive `originalPath`, `storedPath` (pointing at that copy), `widthPx`, `heightPx`, and `thumbnailDataUrl` from it, and SHALL clear the `missing` flag, without changing the asset's `id` or any existing slot assignments that reference it.

#### Scenario: Opening a project with missing images shows a relink dialog
- **WHEN** a project finishes opening with at least one `missing` image
- **THEN** a dialog SHALL list every missing asset with a "Locate..." action per row

#### Scenario: Locating a file relinks that asset in place
- **WHEN** the user uses "Locate..." for a missing asset and selects a valid image file
- **THEN** that asset's `originalPath`, `storedPath`, `widthPx`, `heightPx`, and `thumbnailDataUrl` SHALL be updated from the newly selected file, with `storedPath` pointing at its working-directory copy
- **AND** its `missing` flag SHALL be cleared
- **AND** its `id` and every slot assignment referencing that `id` SHALL remain unchanged

#### Scenario: Dismissing the relink dialog without fixing everything leaves assets relinkable later
- **WHEN** the user closes the relink dialog while one or more assets are still `missing`
- **THEN** those assets SHALL remain in the `imagePool` with `missing: true`
- **AND** each SHALL still show a "Locate..." action on its Image Library card afterward

## REMOVED Requirements

### Requirement: Saved Project Files Omit Image Thumbnails
**Reason**: Superseded by "Saved Project Files Are Self-Contained Bundles" — the container now embeds every pool image's full bytes (reversing the previous "no image file SHALL be copied... as part of saving" guarantee), and `storedPath` is no longer part of the persisted shape at all, so a requirement scoped only to "thumbnails are omitted" no longer captures what actually changed between the in-memory and persisted asset shape.
**Migration**: None. No legacy `.eppproj` files are supported by this change; there is nothing to migrate.

### Requirement: Migrating Legacy Per-Page Sheet Size
**Reason**: This change makes `.eppproj` a zip archive; any pre-this-change file (plain JSON) now fails to open before it ever reaches `migrateProject`, so this requirement describes migration behavior that can no longer be triggered.
**Migration**: None. No legacy `.eppproj` files are supported by this change; there is nothing to migrate.

## ADDED Requirements

### Requirement: Saved Project Files Are Self-Contained Bundles
A `.eppproj` file written by `File > Save` or `File > Save As...` SHALL be a zip archive containing a `project.json` entry (`schemaVersion`, `id`, `name`, `sheetSize`, `pages`, and one `imagePool` entry per asset with `id`, `originalPath`, `fileName`, `widthPx`, `heightPx`, and `dpiOriginal` if known — but no `thumbnailDataUrl`, `missing` flag, or `storedPath`) and one image entry per pool entry at `images/<assetId>.<ext>` holding that asset's current bytes. The write SHALL be atomic: the archive SHALL be built at a temporary location and renamed over the target path only once complete, so a save that fails partway through cannot corrupt a previously saved file at that path.

#### Scenario: Saved file has no embedded thumbnail data or working-directory paths
- **WHEN** a project containing one or more images is saved
- **THEN** the written `project.json`'s `imagePool` entries SHALL NOT contain a `thumbnailDataUrl`, `missing`, or `storedPath` field

#### Scenario: Saved file stores sheet size once, not per page
- **WHEN** a project is saved
- **THEN** the written `project.json` SHALL contain exactly one top-level `sheetSize` field
- **AND** no entry in `pages` SHALL contain a `sizePreset` or `customSizeMm` field

#### Scenario: Saved file embeds every pool image's current bytes
- **WHEN** a project is saved
- **THEN** the archive SHALL contain one image entry for every `imagePool` entry, holding that asset's current working-directory bytes
- **AND** opening that saved file back up SHALL make every one of those images available without the originally ingested file needing to still exist anywhere

#### Scenario: A failed save does not corrupt the previous file
- **WHEN** writing the archive fails partway through (e.g. disk full)
- **THEN** the file previously at the target path (if any) SHALL remain intact and openable
- **AND** the failed save SHALL be surfaced to the user as an error

### Requirement: Project Working Storage Is Session-Scoped, Not Persisted
The application SHALL maintain one working directory per running session, holding a real, decodable copy of every `imagePool` asset's current bytes. Every `ImageAsset.storedPath` SHALL point into this working directory for the lifetime of the process; no other part of the system — a saved `project.json`, a rendered UI, an IPC contract — SHALL treat a `storedPath` value as meaningful beyond the current session. The working directory SHALL be replaced (previous contents discarded, best-effort) whenever the in-memory document is replaced wholesale (`File > New`, `File > Open`), and SHALL be cleaned up on a best-effort basis when the application quits.

#### Scenario: storedPath never appears in a saved file
- **WHEN** a project is saved
- **THEN** no `storedPath` value SHALL appear anywhere in the written archive

#### Scenario: Starting a new project discards the previous working directory
- **WHEN** the user confirms `File > New`, discarding the current document
- **THEN** the working directory backing the discarded document's images SHALL be removed on a best-effort basis
- **AND** a fresh working directory SHALL back any images added to the new document

#### Scenario: Opening a project replaces the working directory
- **WHEN** a project is opened
- **THEN** a fresh working directory SHALL be populated from that project's archive
- **AND** the previous working directory (if any) SHALL be removed on a best-effort basis
