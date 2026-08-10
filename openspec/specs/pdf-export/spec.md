# pdf-export Specification

## Purpose

Lets a user turn the current project into a portable PDF file, with every page rendered at its own configured size, orientation, and DPI, and every placed image at print resolution.

## Requirements

### Requirement: Export PDF Produces a Multi-Page File
Activating the "Export PDF" control SHALL generate a single PDF file containing one PDF page per page in the current project, in the same order as the project's page list. Each PDF page SHALL match the project's single document-level sheet size (standard preset or custom size), that page's own orientation, and content exactly as rendered in print preview: every placed image at the same position, scale, and rotation preview computes for it, and at a resolution sufficient to cover its actual print size at that page's configured DPI (up to the source image's own native resolution). Empty `imageSlot`s and slots with a missing image asset SHALL render as blank page background, with no placeholder, border, or diagnostic indicator.

#### Scenario: A multi-page project exports every page in order
- **WHEN** the user activates "Export PDF" on a project with more than one page
- **THEN** the resulting PDF SHALL contain one page per project page, in the project's page order

#### Scenario: Pages with different orientations are each exported at their own orientation
- **WHEN** the project's pages have different configured orientations
- **THEN** each PDF page SHALL match the orientation configured on its corresponding project page, while every page SHALL share the same underlying sheet size (the project's single document-level `sheetSize`)

#### Scenario: Placed images render at print resolution
- **WHEN** a page being exported has an image placed in an `imageSlot` or as a `freeformCanvas` element
- **THEN** the exported PDF page SHALL render that image at a resolution sufficient to cover its actual print size at the page's configured DPI, the same resolution rule print preview uses

#### Scenario: Empty and missing-asset slots export blank
- **WHEN** a page being exported has an `imageSlot` with no assigned image, or assigned to an image asset whose source file is missing
- **THEN** that slot's area in the exported PDF SHALL show only the page's blank background, with no placeholder text, border, badge, or other indicator

### Requirement: Export Destination Is User-Chosen
Activating "Export PDF" SHALL prompt the user with a native save-file dialog to choose the destination path before writing the file. Canceling that dialog SHALL leave the document and application state unchanged and SHALL NOT write any file.

#### Scenario: User picks a destination and export completes
- **WHEN** the user activates "Export PDF" and chooses a destination in the save dialog
- **THEN** the PDF SHALL be written to that path
- **AND** the application SHALL indicate the export completed

#### Scenario: User cancels the destination dialog
- **WHEN** the user activates "Export PDF" and cancels the save dialog
- **THEN** no file SHALL be written
- **AND** the document and application state SHALL remain exactly as they were before the control was activated

### Requirement: Export Failure Is Surfaced, Not Silent
If PDF generation or writing the destination file fails for any reason (unreadable source image, unwritable destination, or any other error), the application SHALL leave the document and application state unchanged and SHALL show the user a visible indication that the export failed, rather than failing silently or leaving the control appearing to still be working indefinitely.

#### Scenario: Export fails partway through
- **WHEN** PDF generation or the file write fails after the user has chosen a destination
- **THEN** the application SHALL show a visible error indication
- **AND** the document and application state SHALL remain unchanged
