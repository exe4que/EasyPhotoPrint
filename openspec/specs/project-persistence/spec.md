# project-persistence Specification

## Purpose
The project-persistence capability covers how images are ingested into the in-memory image pool, how the `EPPProject`/`Page`/`ImageAsset` data model and its slot-assignment logic behave in the renderer store, and how a project is saved to and loaded from a lightweight `.eppproj` file on disk — including detecting and relinking images whose source file has moved, been renamed, or been deleted since the project was last saved.
## Requirements
### Requirement: Native Image Ingestion Dialog
The system SHALL provide a native "open file" dialog (invoked via the `dialog:open-images` IPC channel) that lets the user select one or more image files, filtered to common raster formats (`png`, `jpg`, `jpeg`, `webp`, `gif`, `bmp`, `tiff`). For each selected file, the Main process SHALL read its pixel dimensions and generate a downscaled thumbnail whose longer edge does not exceed 240px, encoded as a data URL, and return one `ImageAsset` per selected file to the renderer, which SHALL append them to the in-memory `imagePool`.

#### Scenario: Selecting images adds them to the pool
- **WHEN** the user clicks "Load images" and selects one or more files in the native dialog
- **THEN** each selected file SHALL produce a new `ImageAsset` (with a fresh `id`, decoded `widthPx`/`heightPx`, and a `thumbnailDataUrl`) appended to the store's `imagePool`, without removing any previously loaded assets

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
Every `ImageAsset` produced by ingestion SHALL include a UUID `id`, an `originalPath` and `storedPath` (both set to the source file's path today, since no per-project asset copy step exists yet), a `fileName`, integer `widthPx`/`heightPx`, and a `thumbnailDataUrl`.

#### Scenario: Ingested asset has stable identity and file metadata
- **WHEN** an image file is ingested through the native dialog
- **THEN** the resulting `ImageAsset` SHALL have a unique `id`, `fileName` set to the file's base name, and `originalPath`/`storedPath` both set to the file's filesystem path

### Requirement: In-Memory EPPProject Data Model
The renderer's `document` state SHALL hold a single document-level `sheetSize`, shared by every page, and a `pages` array, where each page has its own `id`, `pageConfig` (`orientation` and `dpi` only), an optional `templateRef`, a `rootNode` layout tree, and an `assignments` map from `LayoutNode.id` (of an `imageSlot`) to `ImageAsset.id`. The store SHALL additionally hold a single shared `imagePool` array of `ImageAsset`, independent of any individual page.

#### Scenario: Initial document has one page with an empty assignment map
- **WHEN** the application store initializes
- **THEN** `document.pages` SHALL contain exactly one page with a default `pageConfig` (`orientation: portrait`, `dpi: 300`), a default `rootNode` (a single `imageSlot`), and an empty `assignments` map

#### Scenario: Assignments reference layout node ids, not a separate slot id
- **WHEN** an image is assigned to an `imageSlot`
- **THEN** the assignment SHALL be keyed by that node's own `LayoutNode.id`, with no separate `slotId` field involved

### Requirement: PageConfig Is Independent Per Page
Each page's `pageConfig` (`orientation`, `dpi`) SHALL be stored and editable independently of every other page's `pageConfig`, so that pages in the same document can carry different orientations or DPI values. Sheet size (`sizePreset`, optional `customSizeMm`) is NOT part of any page's `pageConfig` — it lives solely on the document-level `sheetSize` field (see "Document-Level Sheet Size" below), and is therefore always identical across every page in a document; there is no per-page action or field capable of diverging it.

#### Scenario: Updating one page's pageConfig does not affect other pages
- **WHEN** `updatePageConfig` is called for a given page id with a patch (e.g. a new `orientation`)
- **THEN** only that page's `pageConfig` SHALL change; every other page's `pageConfig` in `document.pages` SHALL remain exactly as it was

### Requirement: Assigning an Image Replaces the Slot's Occupant by Default
The store's slot-assignment logic (`assignImageToPage`, exposed to the UI via the `assignImageToSlot` action, which the canvas wires up for drag-and-drop from the Image Library panel) SHALL, by default, replace the target slot's assignment with the given image, discarding any previous occupant of that slot from the assignments map (the previous image is not deleted from the pool — it simply stops being referenced by that slot).

#### Scenario: Assigning a library image replaces the slot's current image
- **WHEN** an image is dropped from the Image Library panel onto a slot that already has a different image assigned
- **THEN** the target slot's assignment SHALL be updated to the dropped image's id, and the slot's previous image SHALL no longer appear in the assignments map for that slot

#### Scenario: Assigning to an empty slot creates a new assignment
- **WHEN** an image is dropped onto a slot with no current assignment
- **THEN** the slot SHALL become assigned to that image with no other assignment on the page affected

### Requirement: Assignment Logic Swaps When the Source Is Another Slot on the Same Page
The store's slot-assignment logic (`assignImageToPage`, exposed to the UI via the `assignImageToSlot` action) SHALL accept a `source` of `'library'` (the default) or `'page'`. The canvas SHALL determine this source at drop time: a drag that originates from the Image Library panel SHALL use `source: 'library'`, and a drag that originates from an already-assigned `imageSlot` on the same page SHALL use `source: 'page'`. When called with `source: 'page'` for an image that is already assigned to a different slot on the same page, the assignment logic SHALL swap the two slots' assignments (each ends up with the other's previous image) instead of one slot's assignment simply clobbering the other's.

#### Scenario: Dragging an assigned slot's image onto another slot swaps them
- **WHEN** the user drags the image out of a slot that already has an image assigned and drops it onto a different slot on the same page that also has an image assigned
- **THEN** the target slot SHALL receive the dragged image, and the source slot SHALL receive the image the target slot held before the drop

#### Scenario: Dragging an assigned slot's image onto an empty slot moves it
- **WHEN** the user drags the image out of a slot that has an image assigned and drops it onto an empty slot on the same page
- **THEN** the target slot SHALL become assigned to that image, and the source slot SHALL become unassigned

#### Scenario: Dragging from the Image Library panel never swaps
- **WHEN** an image is dragged from the Image Library panel (not from another slot) and dropped onto a slot, regardless of whether that image is already assigned elsewhere on the page
- **THEN** the target slot's assignment SHALL simply be replaced with the dropped image, and no other slot's assignment SHALL change as a side effect

#### Scenario: Page-source swap does not affect unrelated slots
- **WHEN** a page-source swap occurs between two slots
- **THEN** every other slot's assignment on that page SHALL remain unchanged

### Requirement: Images Are Not Exclusive
The system SHALL allow the same `ImageAsset` id to appear as the assignment value for more than one slot at a time, including slots on the same page.

#### Scenario: The same image is assigned to two slots on one page
- **WHEN** an already-assigned image is dropped onto a second, different slot on the same page (arriving via the library source path)
- **THEN** both slots' assignments SHALL reference that same `ImageAsset.id` simultaneously, and neither assignment SHALL be cleared as a side effect

### Requirement: Clearing a Slot's Assignment
The system SHALL provide a `clearImageFromSlot` action that removes a single slot's entry from the page's assignments map without altering any other slot's assignment.

#### Scenario: Clearing one slot leaves other assignments intact
- **WHEN** `clearImageFromSlot` is called for a slot that currently has an image assigned
- **THEN** that slot's entry SHALL be removed from the page's `assignments` map, and every other slot's assignment on that page SHALL remain unchanged

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
A `.eppproj` file written by `File > Save` or `File > Save As...` SHALL contain `schemaVersion`, `id`, `name`, `sheetSize`, `pages`, and `imagePool`, where each page's `pageConfig` contains only `orientation` and `dpi` (sheet size lives solely in the top-level `sheetSize`, not per page), and each `imagePool` entry SHALL include `id`, `originalPath`, `storedPath`, `fileName`, `widthPx`, `heightPx`, and `dpiOriginal` if known, but SHALL NOT include `thumbnailDataUrl`. No image file SHALL be copied anywhere as part of saving.

#### Scenario: Saved file has no embedded thumbnail data
- **WHEN** a project containing one or more images is saved
- **THEN** the written JSON's `imagePool` entries SHALL NOT contain a `thumbnailDataUrl` field
- **AND** no new image file SHALL be created on disk as a result of the save

#### Scenario: Saved file stores sheet size once, not per page
- **WHEN** a project is saved
- **THEN** the written JSON SHALL contain exactly one top-level `sheetSize` field
- **AND** no entry in `pages` SHALL contain a `sizePreset` or `customSizeMm` field

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

### Requirement: Document-Level Sheet Size
The system SHALL store a single `sheetSize` (`sizePreset`, one of `A4`, `Letter`, `Legal`, `4x6`, `5x7`, `A3`, `Custom`; and an optional `customSizeMm` of `{ widthMm, heightMm }` used only when `sizePreset` is `Custom`) on the document/project, shared by every page. The store SHALL provide an `updateSheetSize` action that updates this single value. No page-level action or field SHALL be capable of setting a sheet size different from this document-level value.

#### Scenario: Document initializes with a default sheet size
- **WHEN** the application store initializes, or a new project is created via `File > New`
- **THEN** `document.sheetSize.sizePreset` SHALL default to `A4`

#### Scenario: Changing the sheet size affects every page uniformly
- **WHEN** `updateSheetSize` is called with a new `sizePreset`
- **THEN** `document.sheetSize` SHALL update to that value
- **AND** every page in `document.pages` SHALL resolve against that single updated value, since no page carries its own copy that could fall out of sync

#### Scenario: Custom sheet size is only honored when the preset is Custom
- **WHEN** `document.sheetSize.sizePreset` is not `Custom`
- **THEN** any stored `customSizeMm` value SHALL be ignored for size resolution, the same as the prior per-page behavior

### Requirement: Migrating Legacy Per-Page Sheet Size
Opening a `.eppproj` file saved by a schema version that predates document-level `sheetSize` SHALL derive the document's `sheetSize` from the first page's legacy `sizePreset`/`customSizeMm`, and SHALL strip `sizePreset`/`customSizeMm` from every page's `pageConfig` during load, leaving `orientation`/`dpi` in place on each page.

#### Scenario: Opening a legacy project derives sheet size from the first page
- **WHEN** a pre-change `.eppproj` file is opened
- **THEN** the loaded project's `document.sheetSize` SHALL equal the first page's legacy `sizePreset`/`customSizeMm`
- **AND** every page's `pageConfig` SHALL contain only `orientation`/`dpi` after loading

#### Scenario: Opening a legacy project whose pages had been manually diverged discards the divergence
- **WHEN** a pre-change `.eppproj` file has pages with different `sizePreset`/`customSizeMm` values (only reachable by hand-editing the file, since the UI never exposed a way to diverge them)
- **THEN** the loaded project's `document.sheetSize` SHALL be derived from the first page's size
- **AND** every other page's original size value SHALL be discarded, not preserved anywhere

