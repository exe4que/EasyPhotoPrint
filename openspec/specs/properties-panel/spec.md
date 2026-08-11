# properties-panel Specification

## Purpose

Gives the user one consistent place — the Properties panel — to see and edit whatever is currently selected, and makes selection itself a single, app-wide concept instead of two independent ones.

## Requirements

### Requirement: App-Wide Single Selection
The application SHALL track at most one selected thing at a time across the whole app: either a layout node (an `imageSlot`, `grid`, `horizontal`, `vertical`, or `freeformCanvas` node, selected from the canvas or the layout tree) or an image in the Image Library — never both simultaneously. Selecting one SHALL replace whatever was previously selected, regardless of its kind.

#### Scenario: Selecting a library image clears a previously selected node
- **WHEN** a layout node is currently selected and the user clicks an image thumbnail in the Image Library
- **THEN** the image becomes the selection and the previously selected node is no longer selected

#### Scenario: Selecting a node clears a previously selected library image
- **WHEN** a library image is currently selected and the user selects a layout node from the canvas or the layout tree
- **THEN** the node becomes the selection and the previously selected image is no longer selected

#### Scenario: Selecting a freeform element selects its backing node
- **WHEN** the user selects a `FreeformElement` placed on a `freeformCanvas`
- **THEN** that element's backing `imageSlot` node becomes the selection, the same as selecting any other layout node

### Requirement: Properties Panel Shows Content Appropriate to the Selection
The Properties panel SHALL display content based on what is currently selected: an `imageSlot` node's scaling/rotation/size/padding controls when an `imageSlot` is selected, a container node's structural controls (grid rows/columns, gap, padding, or slot count) when a `grid`/`horizontal`/`vertical`/`freeformCanvas` node is selected, or the selected image's filename and pixel dimensions when a library image is selected. There SHALL NOT be a separate panel showing selection details.

#### Scenario: Selecting an imageSlot shows its slot properties
- **WHEN** an `imageSlot` node is selected
- **THEN** the Properties panel shows that slot's scaling rule, rotation, padding, and (when applicable) specific-size controls, along with its assigned image's info

#### Scenario: Selecting a container node shows its structural properties
- **WHEN** a `grid`, `horizontal`, `vertical`, or `freeformCanvas` node is selected
- **THEN** the Properties panel shows that node's structural controls (grid rows/columns and gap for `grid`; slot count for `horizontal`/`vertical`; padding for all applicable types)

#### Scenario: Selecting a library image shows its details in the Properties panel
- **WHEN** the user selects an image in the Image Library
- **THEN** the Properties panel shows that image's filename and pixel dimensions instead of any node's properties

### Requirement: Properties Panel Falls Back to the Root Node
Whenever nothing is selected, the Properties panel SHALL show the active page's root node's properties, regardless of the current layout mode (Simple or Nested) and regardless of the root node's own type.

#### Scenario: No selection in Simple mode shows the root's properties
- **WHEN** nothing is selected and the layout mode is Simple
- **THEN** the Properties panel shows the active page's root node's properties

#### Scenario: No selection in Nested mode shows the root's properties regardless of its type
- **WHEN** nothing is selected, the layout mode is Nested, and the active page's root node is a `horizontal`, `vertical`, or `freeformCanvas` node (not a `grid`)
- **THEN** the Properties panel shows that root node's properties, the same as it would for a `grid` root

### Requirement: Properties Panel Can Retype the Selected Node
The Properties panel SHALL show a control to change the type (`grid`, `horizontal`, `vertical`, `imageSlot`, or `freeformCanvas`) of whichever layout node is currently in view — the selected node, or the root node when nothing is selected — regardless of layout mode. This is in addition to, not a replacement for, the layout tree's own per-node type control in Nested mode.

#### Scenario: Changing the type of a selected non-root node
- **WHEN** a non-root layout node is selected and the user changes its type using the Properties panel's control
- **THEN** that node's type changes accordingly, the same as changing it from the layout tree would

#### Scenario: Changing the root node's type when nothing is selected
- **WHEN** nothing is selected (so the panel shows the root node) and the user changes the root's type using the Properties panel's control
- **THEN** the root node's type changes accordingly
