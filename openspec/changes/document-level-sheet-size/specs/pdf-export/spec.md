## MODIFIED Requirements

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
