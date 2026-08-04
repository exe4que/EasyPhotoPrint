# canvas-container-outlines Specification

## Purpose
The canvas-container-outlines capability defines how Nested mode's page preview visually distinguishes structural container nodes from their leaf content, via a dashed outline and an id badge per container — and, just as importantly, which nodes are explicitly excluded from that treatment so the canvas never shows noise for nodes that aren't containers a user edits directly.
## Requirements
### Requirement: Nested Mode Outlines Structural Containers
In Nested mode, every `grid`, `horizontal`, `vertical`, and `freeformCanvas` node in the active page's tree (other than the root node) SHALL render a dashed outline at its resolved box, with an id badge (or "root" if it is the page's root node) positioned at its top-left corner. In Simple mode, no such outlines are shown.

#### Scenario: A nested horizontal container shows its outline and id
- **WHEN** the layout mode is Nested and a page's tree contains a non-root `horizontal` container
- **THEN** a dashed-border box SHALL render at that container's resolved position and size, with its id shown in a badge at its top-left corner

#### Scenario: A freeformCanvas container shows its own outline and id
- **WHEN** the layout mode is Nested and a page's tree contains a `freeformCanvas` node (root or nested)
- **THEN** that `freeformCanvas` node SHALL render its own dashed-border outline and id badge, the same treatment every other container type receives

#### Scenario: Simple mode shows no container outlines
- **WHEN** the layout mode is Simple
- **THEN** no dashed container outlines or id badges SHALL render, regardless of the tree's structure

### Requirement: Individual Freeform Elements Are Never Treated as Containers
A `FreeformElement` placed inside a `freeformCanvas` SHALL NOT receive the container outline/id-badge treatment, even though it has its own resolved box in the layout result (recorded under the element's own id, not a `LayoutNode` id). Distinguishing containers from freeform elements SHALL be done by positively checking each id against the set of actual `grid`/`horizontal`/`vertical`/`freeformCanvas` node ids in the tree, not by excluding known non-container id sets — since a `FreeformElement`'s id belongs to neither exclusion set and must not be able to slip through by omission.

#### Scenario: Placing a freeform element does not add a stray outline
- **WHEN** one or more images are placed inside a `freeformCanvas` in Nested mode
- **THEN** no dashed outline or id badge SHALL render at any individual freeform element's position — only the `freeformCanvas` container itself SHALL show an outline and badge

#### Scenario: A freeform element's own id never coincides with a container outline
- **WHEN** a `FreeformElement`'s generated id is compared against the tree's container ids
- **THEN** it SHALL never match, regardless of its format, because container identification is based on the node actually being a `grid`/`horizontal`/`vertical`/`freeformCanvas` `LayoutNode` in the tree, not on excluding other known id shapes

### Requirement: Image Slots Are Excluded from Container Outlines
An `imageSlot` node, whether a direct grid/flex child or the shadow slot backing a `FreeformElement`, SHALL NOT receive the container outline/id-badge treatment — image slots have their own dedicated selection/assignment visual treatment elsewhere in the canvas.

#### Scenario: An imageSlot never shows a container-style outline
- **WHEN** the layout mode is Nested and the tree contains `imageSlot` nodes (grid/flex children or freeform-backing slots)
- **THEN** none of those `imageSlot` nodes SHALL render the dashed container outline or id badge
