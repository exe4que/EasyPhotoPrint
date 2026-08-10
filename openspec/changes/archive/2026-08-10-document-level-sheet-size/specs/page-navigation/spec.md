## MODIFIED Requirements

### Requirement: Adding a Page
The application SHALL provide a control that appends a new page to the document, using the document's current `sheetSize` (unchanged by the new page — there is no per-page size to set), the app's default per-page `pageConfig` (portrait, 300dpi), and a blank single-`imageSlot` `rootNode` with no image assignments — the same default shape the document's very first page is created with. The newly added page SHALL become the active page.

#### Scenario: Adding a page appends it with the app's default configuration
- **WHEN** the user activates the "Add Page" control
- **THEN** a new page is appended to `document.pages` with `pageConfig` set to portrait/300dpi, a `rootNode` that is a single blank `imageSlot`, and an empty `assignments` map
- **AND** the document's `sheetSize` is left completely unchanged, and the new page resolves at that same shared sheet size
- **AND** every other existing page in the document is left completely unchanged

#### Scenario: The new page becomes the active page immediately
- **WHEN** the user activates the "Add Page" control
- **THEN** the newly created page becomes the active page, without requiring a separate navigation step
