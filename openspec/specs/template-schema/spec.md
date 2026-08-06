# template-schema Specification

## Purpose
The template-schema capability defines the `EPPTemplate` document (a single page's structure — page config plus a tree of `LayoutNode`s — with no image assignments), and the disk-backed CRUD, save/save-as, reconciliation, and preview behaviors that let a user create, reuse, and update reusable page layouts independently of the photos assigned to them.
## Requirements
### Requirement: EPPTemplate Structure-Only Shape
An `EPPTemplate` SHALL describe exactly one page's structure and SHALL NOT contain any image assignment data. It SHALL require `schemaVersion`, `id` (a UUID), `name` (non-empty), `page` (a page configuration), and `rootNode` (a `LayoutNode` tree), and MAY additionally carry `createdAt`/`updatedAt` timestamps.

#### Scenario: Exporting the active page as a template omits assignments
- **WHEN** the user exports the current page's structure as a template
- **THEN** the resulting object SHALL contain only `schemaVersion`, `id`, `name`, `page`, and `rootNode` (a deep copy of the page's layout tree) and SHALL NOT contain the page's slot-to-image assignment map

#### Scenario: Page config shape
- **WHEN** a template's `page` field is constructed
- **THEN** it SHALL contain `sizePreset` (one of `A4`, `Letter`, `Legal`, `4x6`, `5x7`, `A3`, `Custom`), `orientation` (`portrait` or `landscape`), `dpi` (a number, defaulting to `300`), and an optional `customSizeMm` of `{ widthMm, heightMm }` used only when `sizePreset` is `Custom`

### Requirement: LayoutNode Tree Shape
Every node in a template's `rootNode` tree SHALL have an `id` and a `type` of `grid`, `horizontal`, `vertical`, `imageSlot`, or `freeformCanvas`, and MAY carry `sizeRatio` (relative weight in its parent, default `1`), `fixedSizeMm` (`{ widthMm?, heightMm? }`, independent per axis), `alignment` (`{ horizontal?: left|center|right|expand, vertical?: top|center|bottom|expand }`), `gapMm` (default `0`), `paddingMm` (`{ top?, right?, bottom?, left? }`), `gridConfig`, `imageSlotConfig`, `freeformElements`, and `children` (an array of nested `LayoutNode`s).

#### Scenario: Constructing a nested container node
- **WHEN** a `horizontal` or `vertical` node is created with children
- **THEN** each child SHALL itself be a valid `LayoutNode`, allowing containers to nest to arbitrary depth within the tree

### Requirement: ImageSlot Scaling Configuration
An `imageSlot` node's `imageSlotConfig` SHALL support `aspectRatio` (a desired width/height ratio), `scalingRule` (one of `fitInParent`, `envelopeParent`, `stretch`, or `specificSize`, defaulting to `fitInParent`), `focalPoint` (`{ x, y }` normalized 0..1, used by `envelopeParent`), `specificSizeMm` (`{ widthMm, heightMm, lockedAxis: width|height|both }`, used only when `scalingRule` is `specificSize`), and `imageRotationDeg` (one of `0`, `90`, `180`, `270`, defaulting to `0`, applied clockwise to the assigned image before any scaling-rule fit/crop/stretch math and independent of the slot's own box shape), all as optional fields.

#### Scenario: Default scaling rule
- **WHEN** an `imageSlot` node's `imageSlotConfig` omits `scalingRule`
- **THEN** the effective scaling rule SHALL be treated as `fitInParent`

#### Scenario: Default image rotation
- **WHEN** an `imageSlot` node's `imageSlotConfig` omits `imageRotationDeg`
- **THEN** the effective image rotation SHALL be treated as `0` (no rotation), and the slot's own resolved box/shape SHALL be entirely unaffected by this field regardless of its value

#### Scenario: Image rotation is independent of the shadow slot backing a freeform element
- **WHEN** an `imageSlot` node is the shadow slot referenced by a `freeformCanvas`'s `FreeformElement.imageNodeId`
- **THEN** `imageRotationDeg` on that shadow slot's `imageSlotConfig` SHALL have no defined UI-driven way to be set, and rendering for that element SHALL continue to use the `FreeformElement`'s own `transform.rotationDeg` exclusively

### Requirement: FreeformElement Shape
A `freeformCanvas` node's `freeformElements` array SHALL contain objects with `id`, `imageNodeId` (referencing the `id` of an `imageSlot` `LayoutNode` elsewhere in the tree), an optional `zIndex` (default `0`), and a `transform` of `{ xMm, yMm, widthMm, heightMm, rotationDeg (-180..180), lockAspectRatio? (default true) }`.

#### Scenario: Freeform element references a slot by node id
- **WHEN** a `FreeformElement` is created for an image placed on a `freeformCanvas`
- **THEN** its `imageNodeId` SHALL equal the `id` of the corresponding `imageSlot` `LayoutNode`, with no separate slot identifier involved

### Requirement: LayoutNode.id Is the Single Stable Slot Identifier
A `LayoutNode`'s `id` SHALL be the only identifier used to reference that node — there SHALL be no separate `slotId` field. An `id` SHALL remain stable for the logical lifetime of the node and SHALL NOT be regenerated when a node is moved, reordered, or wrapped, nor during template reconciliation; a new `id` SHALL only be generated when the user creates a brand-new node.

#### Scenario: Reconciling a template preserves ids for unchanged slots
- **WHEN** a template's tree is reconciled against a new version that still contains an `imageSlot` with the same `id`
- **THEN** that `id` SHALL be treated as the same logical slot, and any existing image assignment keyed by that `id` SHALL be preserved

### Requirement: Templates Are Loaded Through a Schema Migration Step
Reading any template from disk SHALL first pass its raw parsed JSON through a migration function that validates `schemaVersion` is one of the currently supported versions, and validates that `id`, `name`, `page`, and `rootNode` are present and well-formed at a structural level, before the document is used anywhere else in the app.

#### Scenario: Template with an unsupported schema version is rejected
- **WHEN** a `.epptemplate` file on disk has a `schemaVersion` that is not in the set of currently supported versions
- **THEN** loading it SHALL fail with an error rather than being silently accepted or partially interpreted

#### Scenario: Template missing a required top-level field is rejected
- **WHEN** a `.epptemplate` file is missing `page` or `rootNode`, or `rootNode` is missing a valid `id`/`type`
- **THEN** loading it SHALL fail with an error identifying the invalid document

### Requirement: Template Persistence Is Disk-Backed and Per-User
Templates SHALL be stored as individual files, one per template, in a `templates` subdirectory of the OS-specific per-user application data directory, named by the template's `id`. All access from the renderer SHALL go through explicit IPC channels (`templates:list`, `templates:save`, `templates:delete`) rather than direct filesystem access.

#### Scenario: Listing templates returns most-recently-updated first
- **WHEN** the renderer requests the list of saved templates
- **THEN** the returned templates SHALL be sorted so that the template with the most recent `updatedAt` (falling back to `createdAt`) appears first

#### Scenario: Saving a template rejects an empty name
- **WHEN** a save request is made for a template whose `name` is empty or only whitespace
- **THEN** the save SHALL fail with an error and no file SHALL be written

#### Scenario: Saving a template stamps timestamps
- **WHEN** a template is saved for the first time
- **THEN** the stored document SHALL have both `createdAt` and `updatedAt` set to the current time; **WHEN** a template with an existing file at that `id` is saved again
- **THEN** the stored document SHALL keep its original `createdAt` and update only `updatedAt` to the current time

#### Scenario: Deleting a template is idempotent
- **WHEN** a delete request is made for a template `id` that has no corresponding file on disk
- **THEN** the operation SHALL complete without error

### Requirement: Save Vs Save As UI Contract
The template-saving UI SHALL offer a "Save" action only when the active page's linked template reference resolves to a template `id` present in the currently loaded template list; "Save" SHALL overwrite that template's file in place using its existing `id` and name. A "Save as" action SHALL always be available; it SHALL save the exported structure under a newly generated `id` and the name the user types, and SHALL link the active page to that new `id` for subsequent saves in the same session.

#### Scenario: Save is unavailable when the page has no linked template
- **WHEN** the active page's linked template reference does not resolve to any template in the current list (never saved, or the linked template was deleted)
- **THEN** the "Save" action SHALL NOT be offered, and only "Save as" SHALL be available

#### Scenario: Save as links the page to the newly created template
- **WHEN** the user completes a "Save as" with a non-empty name
- **THEN** a new template file SHALL be written with a freshly generated `id` and the typed name, and the active page's linked template reference SHALL be updated to that new `id`

#### Scenario: Save as rejects an empty name before submission
- **WHEN** the user attempts to confirm "Save as" with an empty or whitespace-only name
- **THEN** the action SHALL be blocked client-side with a validation message and no save request SHALL be made

#### Scenario: Deleting a template does not touch existing page references
- **WHEN** a template is deleted
- **THEN** no project page's linked template reference SHALL be modified as part of the deletion; a page that previously referenced that `id` SHALL simply no longer find a match when the template list is next loaded, at which point its "Save" action becomes unavailable per the scenario above

### Requirement: In-Place Template Versioning
Saving over an existing template SHALL overwrite its file while keeping the same `id` — it SHALL NOT create a separate versioned copy or a new file.

#### Scenario: Overwriting a template keeps its id
- **WHEN** the user uses "Save" to overwrite a template that already has saved pages referencing it
- **THEN** the file on disk for that `id` SHALL be replaced with the new structure, and the `id` itself SHALL be unchanged

### Requirement: Template Reconciliation by Node Id
Applying a template's structure to a page SHALL reconcile the page's existing slot assignments against the new tree by `LayoutNode.id`: assignments for `imageSlot` ids present in both the old and new tree SHALL be preserved; assignments for ids that no longer exist in the new tree SHALL be dropped from the page's assignment map (the underlying image is not deleted, only unassigned); ids newly introduced by the new tree SHALL start with no assignment.

#### Scenario: Applying a template preserves matching slot assignments
- **WHEN** a template is applied to a page and an `imageSlot` id from the page's previous tree also exists in the new tree
- **THEN** the image previously assigned to that slot id SHALL remain assigned to it after the apply

#### Scenario: Applying a template drops assignments for removed slots
- **WHEN** a template is applied to a page and an `imageSlot` id from the page's previous tree does not exist in the new tree
- **THEN** the page's assignment map SHALL no longer contain an entry for that id, and the previously assigned image SHALL remain part of the image pool rather than being deleted

#### Scenario: Applying a template leaves new slots empty
- **WHEN** a template is applied to a page and the new tree introduces an `imageSlot` id that did not exist in the page's previous tree
- **THEN** that slot SHALL have no assignment after the apply

### Requirement: Dynamic Template Thumbnails
A template's preview thumbnail SHALL NOT be stored as data in the `.epptemplate` file. It SHALL instead be produced by resolving the template's `rootNode` against a page-sized box and rendering one placeholder rectangle per resolved `imageSlot` position, using the same layout resolution used elsewhere in the app.

#### Scenario: Template file contains no thumbnail data
- **WHEN** a template is saved to disk
- **THEN** the written file SHALL contain only `schemaVersion`, `id`, `name`, timestamps, `page`, and `rootNode` — no embedded image or thumbnail data

#### Scenario: Gallery preview reflects the template's actual slot layout
- **WHEN** the template gallery renders a preview for a saved template
- **THEN** it SHALL compute the resolved layout for that template's `rootNode` and draw one placeholder box per `imageSlot` at its resolved position and size, with no photo content shown

