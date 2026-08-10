## MODIFIED Requirements

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

### Requirement: Saved Project Files Omit Image Thumbnails
A `.eppproj` file written by `File > Save` or `File > Save As...` SHALL contain `schemaVersion`, `id`, `name`, `sheetSize`, `pages`, and `imagePool`, where each page's `pageConfig` contains only `orientation` and `dpi` (no `sizePreset`/`customSizeMm` — those live solely in the top-level `sheetSize`), and each `imagePool` entry SHALL include `id`, `originalPath`, `storedPath`, `fileName`, `widthPx`, `heightPx`, and `dpiOriginal` if known, but SHALL NOT include `thumbnailDataUrl`. No image file SHALL be copied anywhere as part of saving.

#### Scenario: Saved file has no embedded thumbnail data
- **WHEN** a project containing one or more images is saved
- **THEN** the written JSON's `imagePool` entries SHALL NOT contain a `thumbnailDataUrl` field
- **AND** no new image file SHALL be created on disk as a result of the save

#### Scenario: Saved file stores sheet size once, not per page
- **WHEN** a project is saved
- **THEN** the written JSON SHALL contain exactly one top-level `sheetSize` field
- **AND** no entry in `pages` SHALL contain a `sizePreset` or `customSizeMm` field

## ADDED Requirements

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
