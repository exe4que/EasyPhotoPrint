## MODIFIED Requirements

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
