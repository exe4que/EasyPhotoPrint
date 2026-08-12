## MODIFIED Requirements

### Requirement: Properties Panel Shows Content Appropriate to the Selection
The Properties panel SHALL display content based on what is currently selected: an `imageSlot` node's scaling/rotation/size/padding controls (plus a "⋮" slot-clipboard menu, per the `slot-clipboard` capability) when an `imageSlot` is selected, a container node's structural controls (grid rows/columns, gap, padding, or slot count) when a `grid`/`horizontal`/`vertical`/`freeformCanvas` node is selected, or the selected image's filename and pixel dimensions when a library image is selected. There SHALL NOT be a separate panel showing selection details.

#### Scenario: Selecting an imageSlot shows its slot properties
- **WHEN** an `imageSlot` node is selected
- **THEN** the Properties panel shows that slot's scaling rule, rotation, padding, and (when applicable) specific-size controls, along with its assigned image's info

#### Scenario: Selecting a container node shows its structural properties
- **WHEN** a `grid`, `horizontal`, `vertical`, or `freeformCanvas` node is selected
- **THEN** the Properties panel shows that node's structural controls (grid rows/columns and gap for `grid`; slot count for `horizontal`/`vertical`; padding for all applicable types)

#### Scenario: Selecting a library image shows its details in the Properties panel
- **WHEN** the user selects an image in the Image Library
- **THEN** the Properties panel shows that image's filename and pixel dimensions instead of any node's properties

#### Scenario: The slot-clipboard menu appears only for imageSlot properties
- **WHEN** the Properties panel is showing an `imageSlot`'s properties, whether because it is selected or because it is the page's root node shown by fallback
- **THEN** the panel shows a "⋮" menu button exposing the slot-clipboard actions (Copy, Copy to siblings, Copy to page, Paste)

#### Scenario: The slot-clipboard menu does not appear for non-slot content
- **WHEN** the Properties panel is showing a container node's structural controls or a library image's details
- **THEN** no "⋮" slot-clipboard menu button is shown
