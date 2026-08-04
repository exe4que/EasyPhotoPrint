## Purpose

The project-persistence capability covers how images are ingested into the in-memory image pool and how the in-memory `EPPProject`/`Page`/`ImageAsset` data model and its slot-assignment logic behave in the renderer store today. It explicitly does NOT cover saving a project to disk or opening a project from disk as an `.eppproj` file — those IPC channels exist but are unimplemented stubs that throw an error, and no requirement in this document claims disk save/load works.

## ADDED Requirements

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
The renderer's `document` state SHALL hold a `pages` array, where each page has its own `id`, `pageConfig`, an optional `templateRef`, a `rootNode` layout tree, and an `assignments` map from `LayoutNode.id` (of an `imageSlot`) to `ImageAsset.id`. The store SHALL additionally hold a single shared `imagePool` array of `ImageAsset`, independent of any individual page.

#### Scenario: Initial document has one page with an empty assignment map
- **WHEN** the application store initializes
- **THEN** `document.pages` SHALL contain exactly one page with a default `pageConfig`, a default `rootNode` (a single `imageSlot`), and an empty `assignments` map

#### Scenario: Assignments reference layout node ids, not a separate slot id
- **WHEN** an image is assigned to an `imageSlot`
- **THEN** the assignment SHALL be keyed by that node's own `LayoutNode.id`, with no separate `slotId` field involved

### Requirement: PageConfig Is Independent Per Page
Each page's `pageConfig` (`sizePreset`, optional `customSizeMm`, `orientation`, `dpi`) SHALL be stored and editable independently of every other page's `pageConfig`, so that pages in the same document can in principle carry different sizes, orientations, or DPI values.

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
The `assignImageToPage` function SHALL accept a `source` of `'library'` (the default) or `'page'`. When called with `source: 'page'` for an image that is already assigned to a different slot on the same page, it SHALL swap the two slots' assignments (each ends up with the other's previous image) instead of one slot's assignment simply clobbering the other's. This swap logic is implemented and covered by unit tests in the store; the currently wired-up canvas drop targets only invoke the `'library'` source path (plain replace), since only the Image Library panel's cards are made draggable today — slot-to-slot dragging is not yet wired into the UI.

#### Scenario: Swapping two slots on the same page via the page-source path
- **WHEN** `assignImageToPage` is called with `source: 'page'` for a slot whose target image is already assigned to a different slot on that same page
- **THEN** the two slots SHALL exchange assignments: the target slot receives the dragged image, and the source slot receives whatever image the target slot held before (or becomes unassigned if the target slot was empty)

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

### Requirement: Disk Save and Load of Projects Are Not Implemented
The `fs:open-project` and `fs:save-project` IPC channels SHALL exist (registered by `registerFsHandlers`) but SHALL each reject with an explicit "not implemented yet" error whenever invoked, rather than reading or writing any `.eppproj` file.

#### Scenario: Invoking open-project fails explicitly
- **WHEN** the `fs:open-project` IPC channel is invoked
- **THEN** the returned promise SHALL reject with an error stating that opening `.eppproj` files is not implemented yet

#### Scenario: Invoking save-project fails explicitly
- **WHEN** the `fs:save-project` IPC channel is invoked with a project payload
- **THEN** the returned promise SHALL reject with an error stating that saving `.eppproj` files is not implemented yet, and no file SHALL be written to disk
