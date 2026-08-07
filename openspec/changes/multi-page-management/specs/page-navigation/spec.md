## Purpose

Lets a user grow a document beyond its single starting page — adding, removing, and switching between pages, each independently editable — and keeps the active Simple/Nested editing mode honest about the page currently on screen.

## ADDED Requirements

### Requirement: Adding a Page
The application SHALL provide a control that appends a new page to the document, using the app's default `pageConfig` (A4, portrait) and a blank single-`imageSlot` `rootNode` with no image assignments — the same default shape the document's very first page is created with. The newly added page SHALL become the active page.

#### Scenario: Adding a page appends it with the app's default configuration
- **WHEN** the user activates the "Add Page" control
- **THEN** a new page is appended to `document.pages` with `pageConfig` set to A4/portrait, a `rootNode` that is a single blank `imageSlot`, and an empty `assignments` map
- **AND** every other existing page in the document is left completely unchanged

#### Scenario: The new page becomes the active page immediately
- **WHEN** the user activates the "Add Page" control
- **THEN** the newly created page becomes the active page, without requiring a separate navigation step

### Requirement: Removing a Page With a One-Page Floor
The application SHALL provide a control that removes the active page from the document, except when it is the only remaining page, in which case the removal SHALL have no effect and the document SHALL always retain at least one page.

#### Scenario: Removing a page when more than one page exists
- **WHEN** the user activates the "Remove Page" control and the document currently has more than one page
- **THEN** the active page is removed from `document.pages`
- **AND** every other page's `id`, `pageConfig`, `rootNode`, and `assignments` are left completely unchanged

#### Scenario: The last remaining page cannot be removed
- **WHEN** the user activates the "Remove Page" control and the document currently has exactly one page
- **THEN** `document.pages` is unchanged and still contains that one page

### Requirement: Removing the Active Page Activates a Neighboring Page
When the page being removed is the active page, the application SHALL activate a neighboring page so the user is never left pointing at a page that no longer exists: the page that now occupies the removed page's former position in the list, or — if the removed page was last in the list — the page immediately before it.

#### Scenario: Removing a page that is not last activates the page that shifts into its place
- **WHEN** the active page is removed and it was not the last page in `document.pages`
- **THEN** the page now occupying that index becomes the active page

#### Scenario: Removing the last page in the list activates the new last page
- **WHEN** the active page is removed and it was the last page in `document.pages`
- **THEN** the page that is now last in `document.pages` becomes the active page

### Requirement: Page Switcher Navigation
The application SHALL expose a page switcher showing the active page's position among the total page count (for example, "Page 2 of 3") with controls to move to the previous or next page, in addition to the Add and Remove controls. The switcher SHALL NOT support reordering pages or displaying page thumbnails in this iteration.

#### Scenario: The switcher reflects the current position and total
- **WHEN** the document has multiple pages and one of them is active
- **THEN** the switcher displays the active page's 1-based position and the total page count

#### Scenario: Moving to the next or previous page changes the active page
- **WHEN** the user activates the "next page" control while not on the last page, or the "previous page" control while not on the first page
- **THEN** the active page becomes the adjacent page in `document.pages`

#### Scenario: Navigation does not wrap around
- **WHEN** the user is on the first page and activates "previous page", or on the last page and activates "next page"
- **THEN** the active page does not change

### Requirement: Active Layout Mode Follows the Active Page's Structure
Whenever the active page changes — via the page switcher, adding a page, or removing a page — the application SHALL recompute the Simple/Nested layout mode from the newly active page's `rootNode`, using the existing Simple-mode compatibility check: Simple mode if the tree is compatible, Nested mode otherwise. This replaces the layout mode's previous behavior of persisting whatever value it last held regardless of which page became active. Manually toggling the layout mode for the page currently on screen (the existing Simple/Nested buttons) is unaffected by this requirement.

#### Scenario: Switching to a Nested-only page shows Nested mode automatically
- **WHEN** the active page changes to a page whose `rootNode` is not Simple-mode compatible
- **THEN** the layout mode becomes Nested, regardless of what the layout mode was on the previously active page

#### Scenario: Switching to a Simple-compatible page shows Simple mode automatically
- **WHEN** the active page changes to a page whose `rootNode` is Simple-mode compatible
- **THEN** the layout mode becomes Simple, regardless of what the layout mode was on the previously active page

#### Scenario: A newly added page opens in Simple mode
- **WHEN** a page is added via the "Add Page" control
- **THEN** the layout mode becomes Simple, since a newly added page's blank single-`imageSlot` `rootNode` is always Simple-mode compatible

### Requirement: The Active Page Re-Anchors After Undo or Redo
Because undo/redo apply raw `document` snapshots and the active page id is UI state excluded from that tracked history (per the `undo-redo` capability), an undo or redo can leave the active page id pointing at a page that no longer exists in the reverted-to `document.pages` (for example, undoing an "Add Page"). Whenever this happens, the application SHALL re-anchor the active page to the document's first page immediately after the undo or redo completes, without that re-anchoring itself becoming a new undo/redo history entry.

#### Scenario: Undoing the addition of a page re-anchors away from the now-deleted page
- **WHEN** the active page is a page that was just added, and the user undoes that addition
- **THEN** the active page becomes the document's first page
- **AND** no new entry is added to the undo/redo history for this re-anchoring

#### Scenario: Redoing the removal of the active page re-anchors to a page that still exists
- **WHEN** the active page was removed, its neighbor became active, and the user redoes back past a state where that neighbor itself no longer exists in the resulting document
- **THEN** the active page re-anchors to the document's first page rather than remaining on a nonexistent page id

#### Scenario: An undo or redo that leaves the active page intact does not re-anchor
- **WHEN** an undo or redo completes and the active page id still refers to a page present in the resulting `document.pages`
- **THEN** the active page id is left unchanged
