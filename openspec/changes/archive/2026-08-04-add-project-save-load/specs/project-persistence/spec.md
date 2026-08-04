## REMOVED Requirements

### Requirement: Disk Save and Load of Projects Are Not Implemented
**Reason**: This change implements real disk save/load behind the `fs:open-project` and `fs:save-project` IPC channels, so the "always rejects" behavior these scenarios documented no longer holds.
**Migration**: See the new "File > Save Writes To a Remembered Path", "File > Save As Always Prompts For a Path", and "File > Open Restores a Saved Project" requirements below.

## ADDED Requirements

### Requirement: File > Save Writes To a Remembered Path
The first time a project is saved (no path remembered yet for the current in-memory project), `File > Save` SHALL open the native save dialog so the user chooses a directory and filename. Every subsequent `File > Save` for that same project SHALL write to that same remembered path without opening any dialog or requiring confirmation, regardless of what has changed in the document since the last save.

#### Scenario: First save on a new project opens the save dialog
- **WHEN** the user triggers `File > Save` on a project that has never been saved and was not opened from an existing file
- **THEN** the native save dialog SHALL open, defaulting to the `.eppproj` extension
- **AND** the resulting file path SHALL be remembered as this project's file path once the save completes

#### Scenario: Subsequent save writes silently
- **WHEN** the user triggers `File > Save` on a project that already has a remembered file path (from a prior save or from `File > Open`)
- **THEN** the file at that path SHALL be overwritten with the current document state
- **AND** no dialog or confirmation SHALL be shown

### Requirement: File > Save As Always Prompts For a Path
`File > Save As...` SHALL open the native save dialog every time it is triggered, regardless of whether the current project already has a remembered file path. Completing the dialog SHALL write a new file at the chosen path and SHALL replace the project's remembered file path with that new one, so subsequent `File > Save` writes silently to the new location instead of the old one.

#### Scenario: Save As on an already-saved project still prompts
- **WHEN** the user triggers `File > Save As...` on a project that already has a remembered file path
- **THEN** the native save dialog SHALL open regardless
- **AND** the original file at the old remembered path SHALL be left untouched

#### Scenario: Save As updates which file subsequent Saves target
- **WHEN** the user completes `File > Save As...` and chooses a new path
- **THEN** the project's remembered file path SHALL become that new path
- **AND** the next `File > Save` SHALL write silently to the new path, not the original one

### Requirement: Saved Project Files Omit Image Thumbnails
A `.eppproj` file written by `File > Save` or `File > Save As...` SHALL contain `schemaVersion`, `id`, `name`, `pages`, and `imagePool`, where each `imagePool` entry SHALL include `id`, `originalPath`, `storedPath`, `fileName`, `widthPx`, `heightPx`, and `dpiOriginal` if known, but SHALL NOT include `thumbnailDataUrl`. No image file SHALL be copied anywhere as part of saving.

#### Scenario: Saved file has no embedded thumbnail data
- **WHEN** a project containing one or more images is saved
- **THEN** the written JSON's `imagePool` entries SHALL NOT contain a `thumbnailDataUrl` field
- **AND** no new image file SHALL be created on disk as a result of the save

### Requirement: File > Open Restores a Saved Project
`File > Open...` SHALL follow the same Main→Renderer confirmation pattern as `File > New`: the renderer SHALL request confirmation before discarding the current in-memory document, and only after the user confirms SHALL it invoke the `fs:open-project` IPC channel, which SHALL show the native open dialog scoped to `.eppproj` files, read and validate the chosen file's contents (via the existing `migrateProject` structural validation), and return the resulting project to the renderer. Applying the returned project SHALL replace `document.pages` and `imagePool`, clear the undo/redo history, and remember the opened file's path so subsequent `File > Save` calls write to it silently.

#### Scenario: Opening a project requires confirmation first
- **WHEN** the user triggers `File > Open...`
- **THEN** the renderer SHALL show a confirmation dialog before doing anything else
- **AND** only on confirmation SHALL it invoke the open-project IPC call

#### Scenario: Canceling the native picker leaves the current project untouched
- **WHEN** the user confirms discarding the current document but then cancels the native file picker
- **THEN** `document.pages`, `imagePool`, and the undo/redo history SHALL remain exactly as they were before `File > Open...` was triggered

#### Scenario: Opening a valid file replaces the document and clears history
- **WHEN** a chosen `.eppproj` file is read and passes `migrateProject` validation
- **THEN** `document.pages` and `imagePool` SHALL be replaced with the file's contents
- **AND** the undo/redo history SHALL be cleared so the previous project cannot be restored via undo
- **AND** the opened file's path SHALL become the project's remembered path for subsequent `File > Save` calls

#### Scenario: An invalid or unreadable file is rejected without touching current state
- **WHEN** the chosen file cannot be parsed as JSON or fails `migrateProject` validation
- **THEN** the open SHALL fail with an error shown to the user
- **AND** `document.pages`, `imagePool`, and the undo/redo history SHALL remain exactly as they were before the open was attempted

### Requirement: Missing Image Detection on Project Open
While opening a project, for each `imagePool` entry the Main process SHALL attempt to regenerate a thumbnail from that entry's `originalPath`. If that path cannot be read or decoded, the entry SHALL be marked `missing: true` and given a placeholder thumbnail instead of aborting the whole open; its `widthPx`/`heightPx` SHALL be taken from the saved file rather than re-read from disk, since they do not require the file to exist. A project whose `imagePool` contains one or more `missing` entries SHALL still load successfully.

#### Scenario: One missing image does not block the rest of the project from loading
- **WHEN** a project is opened and one of its `imagePool` entries' `originalPath` no longer exists on disk
- **THEN** the project SHALL still finish loading with all its pages and other images intact
- **AND** that one entry SHALL have `missing: true` and a placeholder thumbnail
- **AND** that entry's `widthPx`/`heightPx` SHALL match the values stored in the file, not be re-derived

#### Scenario: A successfully re-read image is not marked missing
- **WHEN** a project is opened and an `imagePool` entry's `originalPath` still points to a readable image file
- **THEN** that entry's thumbnail SHALL be regenerated from the file and it SHALL NOT be marked `missing`

### Requirement: Relinking a Missing Image
The user SHALL be able to relink any `imageAsset` marked `missing` to a new file via a native single-file picker, both immediately after opening a project with missing images (via a dialog listing every missing asset with a per-row "Locate..." action) and at any later time (via a persistent "Locate..." affordance on that asset's card in the Image Library panel). Relinking SHALL re-derive `originalPath`, `storedPath`, `widthPx`, `heightPx`, and `thumbnailDataUrl` from the newly chosen file and SHALL clear the `missing` flag, without changing the asset's `id` or any existing slot assignments that reference it.

#### Scenario: Opening a project with missing images shows a relink dialog
- **WHEN** a project finishes opening with at least one `missing` image
- **THEN** a dialog SHALL list every missing asset with a "Locate..." action per row

#### Scenario: Locating a file relinks that asset in place
- **WHEN** the user uses "Locate..." for a missing asset and selects a valid image file
- **THEN** that asset's `originalPath`, `storedPath`, `widthPx`, `heightPx`, and `thumbnailDataUrl` SHALL be updated from the newly selected file
- **AND** its `missing` flag SHALL be cleared
- **AND** its `id` and every slot assignment referencing that `id` SHALL remain unchanged

#### Scenario: Dismissing the relink dialog without fixing everything leaves assets relinkable later
- **WHEN** the user closes the relink dialog while one or more assets are still `missing`
- **THEN** those assets SHALL remain in the `imagePool` with `missing: true`
- **AND** each SHALL still show a "Locate..." action on its Image Library card afterward

### Requirement: Missing Image Renders Distinctly in Assigned Slots
A canvas `imageSlot` (or `FreeformElement`) whose assignment references a `missing` image SHALL render visibly differently from an unassigned slot, so the user can distinguish "nothing was ever assigned here" from "something was assigned but its file is gone".

#### Scenario: A slot assigned to a missing image is not shown as empty
- **WHEN** a slot's assignment references an `ImageAsset` with `missing: true`
- **THEN** the slot SHALL render a distinct "missing image" state rather than the ordinary empty-slot placeholder
