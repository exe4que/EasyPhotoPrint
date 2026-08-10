## MODIFIED Requirements

### Requirement: Print Sends Every Page
Activating the "Print" control SHALL open the operating system's native print dialog for every page of the current project, in the project's page order, in a single print job. Each page SHALL be rendered exactly as print preview renders it: every placed image at the same position, scale, and rotation preview computes for it, and at a resolution sufficient to cover its actual print size at that page's configured DPI (up to the source image's own native resolution). Empty `imageSlot`s and slots with a missing image asset SHALL render as blank page background, with no placeholder, border, or diagnostic indicator. Every page in the print job SHALL use the project's single document-level sheet size; each page's own orientation SHALL be honored to the extent the selected printer and its driver support varying orientation within one print job — where they don't, the printer/driver's own handling of a mixed-orientation document applies, the same as it would for any application.

#### Scenario: Printing a multi-page project sends every page
- **WHEN** the user activates "Print" on a project with more than one page
- **THEN** the native print dialog SHALL open with all of the project's pages, in the project's page order, as a single print job

#### Scenario: Printing a single-page project
- **WHEN** the user activates "Print" on a project with exactly one page
- **THEN** the native print dialog SHALL open with that page's content, rendered at print resolution

#### Scenario: Empty and missing-asset slots print blank
- **WHEN** a page being printed has an `imageSlot` with no assigned image, or assigned to an image asset whose source file is missing
- **THEN** that slot's area in the print output SHALL show only the page's blank background, with no placeholder text, border, badge, or other indicator
