## ADDED Requirements

### Requirement: Applying a Template Never Changes the Document's Sheet Size
Applying a template to a project page SHALL adopt the template's `page.orientation` and `page.dpi` into that page's `pageConfig`, but SHALL NOT adopt the template's `page.sizePreset`/`customSizeMm`. The project's document-level sheet size (per the `project-persistence` capability) SHALL be left completely unchanged by applying a template, regardless of what size the template's own `page` field carries.

#### Scenario: Applying a template updates orientation and DPI but not sheet size
- **WHEN** a template is applied to a page and the template's `page.orientation` or `page.dpi` differs from the page's current values
- **THEN** the page's `pageConfig.orientation`/`pageConfig.dpi` SHALL update to match the template
- **AND** the document's `sheetSize` SHALL remain exactly as it was before the template was applied, even if the template's own `page.sizePreset` differs from it

### Requirement: Exporting a Page as a Template Snapshots the Document's Sheet Size
When a project page is exported as a template (`exportTemplate`), the resulting `EPPTemplate.page.sizePreset`/`customSizeMm` SHALL be taken from the project's current document-level `sheetSize` at the moment of export (since a project page no longer carries its own copy of sheet size), while `page.orientation`/`page.dpi` SHALL still be taken from that page's own `pageConfig`, exactly as before.

#### Scenario: Exported template's size reflects the document's current sheet size
- **WHEN** the user exports the active page as a template
- **THEN** the resulting `EPPTemplate.page.sizePreset` (and `customSizeMm`, if the preset is `Custom`) SHALL equal the project's `sheetSize` at export time
- **AND** the resulting `EPPTemplate.page.orientation`/`page.dpi` SHALL equal the exporting page's own `pageConfig` values
