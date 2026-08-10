# print-preview Specification

## Purpose

Lets a user see the active page exactly as it will be printed — full-screen and free of every editing gizmo — before eventually exporting it to PDF or sending it to a printer.

## Requirements

### Requirement: Preview Entry Point
The application header SHALL show a "Preview" control, positioned to the right of the existing unit toggle. Activating it SHALL switch the application into preview mode without altering the document or any editing state (selection, layout mode, active page).

#### Scenario: Opening preview from the header
- **WHEN** the user activates the "Preview" control in the header
- **THEN** the application switches to preview mode, showing the page that was active immediately beforehand
- **AND** the document, the selection, and the layout mode are left exactly as they were

### Requirement: Full-Screen Faithful Rendering
While in preview mode, the application SHALL occupy the entire application viewport with a rendering of the active page only, showing the page at its correct proportions on a white background, scaled to fit the available screen space with no manual zoom control. This rendering SHALL NOT include any editing gizmo: no slot borders or outlines, no id badges, no assignment-status labels, no dimension overlays, no hover highlighting, no drag-and-drop affordances, no resize dividers, no root padding outline, and none of the editor's side panels.
Every image already placed in the page — in a grid/flex `imageSlot` or as a `freeformCanvas` element — SHALL render at the same position, scale, and rotation it has in the editor. The bitmap resolution used for that rendering is independent of the editor's — the editor may use a lower-resolution source for its own performance reasons, but preview SHALL render each placed image at a resolution sufficient to cover its actual print size at the page's configured DPI, up to the source image's own native resolution.

#### Scenario: The preview screen replaces the editor entirely
- **WHEN** preview mode is active
- **THEN** none of the editor's side panels, canvas gizmos, or zoom controls are visible
- **AND** the active page is shown scaled to fit the screen

#### Scenario: A placed image renders identically to the editor
- **WHEN** an image is assigned to an `imageSlot`, or placed as a `freeformCanvas` element, with a given scaling rule, specific size, and/or rotation
- **THEN** the preview renders that image at the same resulting position, scale, and rotation the editor canvas computes for it

#### Scenario: A placed image renders at print resolution, not the library thumbnail
- **WHEN** an image is placed in the page and preview mode is active
- **THEN** the preview SHALL request and, once available, display that image decoded at a resolution sufficient to cover the size it actually occupies on the page at the page's configured DPI, rather than displaying the Image Library's bounded-edge thumbnail
- **AND** if the source image's native resolution is smaller than what full print coverage would require, the preview SHALL use the source's native resolution rather than upscaling it

#### Scenario: The lower-resolution thumbnail is shown while the print-resolution image loads
- **WHEN** preview mode becomes active, or the active page changes, and a placed image's print-resolution decode has not yet completed
- **THEN** the preview SHALL show that image using the already-available lower-resolution thumbnail immediately, rather than leaving the slot blank or blocking on the decode
- **AND** it SHALL replace that thumbnail with the print-resolution version once the decode completes, without requiring further user action

### Requirement: Empty and Missing-Asset Slots Render Blank
An `imageSlot` with no image assigned, and an `imageSlot` whose assigned image asset is missing (its source file can no longer be found), SHALL both render as empty page background in preview mode, with no placeholder text, border, badge, or other visual indicator — including the editor's own "Image missing" indicator, which is an authoring-time diagnostic that would never appear on a printed page.

#### Scenario: An unassigned slot shows nothing
- **WHEN** the active page has an `imageSlot` with no assigned image
- **THEN** preview mode shows no placeholder text, outline, or badge at that slot's position — only the page's blank background

#### Scenario: A slot with a missing image asset shows nothing
- **WHEN** the active page has an `imageSlot` assigned to an image asset whose source file is missing
- **THEN** preview mode shows no "Image missing" indicator, outline, or filename at that slot's position — only the page's blank background, the same as an unassigned slot

### Requirement: Page Navigation Within Preview
While in preview mode, the application SHALL provide controls to move to the previous or next page and an indicator of the active page's position among the total page count, using the same active-page navigation the editor's page switcher uses. These controls SHALL NOT include adding or removing pages. Navigating to a different page while in preview mode SHALL remain in preview mode.

#### Scenario: Moving to an adjacent page from preview
- **WHEN** the user activates the "next" or "previous" page control while in preview mode and an adjacent page exists
- **THEN** the active page changes to that adjacent page
- **AND** the application remains in preview mode, now showing the newly active page

#### Scenario: Navigation does not wrap and offers no add/remove controls
- **WHEN** the user is on the first page and activates "previous", or on the last page and activates "next", while in preview mode
- **THEN** the active page does not change
- **AND** no control to add or remove a page is available in preview mode

### Requirement: Exiting Preview
The preview screen SHALL show an explicit, visible control to return to the editor. Pressing the Escape key while in preview mode SHALL also return to the editor. Either action SHALL restore the editor view showing the page that was active when preview mode is exited, leaving the document and editing state unchanged.

#### Scenario: Exiting via the explicit control
- **WHEN** the user activates the exit control while in preview mode
- **THEN** the application returns to the editor, showing the page that was active in preview mode

#### Scenario: Exiting via Escape
- **WHEN** the user presses Escape while in preview mode
- **THEN** the application returns to the editor, showing the page that was active in preview mode

#### Scenario: Escape does not also clear editor selection on exit
- **WHEN** the user presses Escape while in preview mode and a selection existed in the editor before preview was opened
- **THEN** exiting preview does not clear that prior selection
- **AND** only exiting preview mode occurs, not the editor's separate "Escape clears selection" behavior

### Requirement: Export and Print Controls Are Wired
The top of the preview screen SHALL show an "Export PDF" control and a "Print" control. Activating "Export PDF" SHALL trigger the behavior defined by the `pdf-export` capability; activating "Print" SHALL trigger the behavior defined by the `printing` capability. While either action is in progress, its control SHALL indicate a busy state and SHALL NOT be re-activatable until that action completes (successfully, with an error, or via user cancellation of a dialog it opened).

#### Scenario: The controls are visible and wired
- **WHEN** the user is in preview mode
- **THEN** an "Export PDF" control and a "Print" control are visible at the top of the screen
- **AND** activating "Export PDF" starts the PDF export flow defined by the `pdf-export` capability
- **AND** activating "Print" starts the print flow defined by the `printing` capability

#### Scenario: A control is busy while its action runs
- **WHEN** the user activates "Export PDF" or "Print"
- **THEN** that control SHALL show a busy state and SHALL NOT trigger a second, overlapping run of the same action if activated again before the first completes
- **AND** the control SHALL return to its normal state once the action completes, fails, or is cancelled
