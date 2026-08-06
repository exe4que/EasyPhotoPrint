# layout-engine Specification

## Purpose
The layout engine resolves a tree of layout nodes (grid, horizontal, vertical, imageSlot, freeformCanvas) against a page box, in millimeters, into a deterministic map of node boxes, and provides the supporting geometry (image fill modes, sibling resize, feasibility checks, freeform containment) that the editor UI renders and the PDF exporter consumes.
## Requirements
### Requirement: Deterministic tree-to-boxes resolution
The system SHALL resolve a layout node tree against an available box into a map from node id to a millimeter box, such that the same tree and the same available box always produce the same map.

#### Scenario: Same input produces same output
- **WHEN** the same root node tree and the same available box are resolved twice
- **THEN** the resulting node-id-to-box map is identical both times

#### Scenario: Every visited node is recorded
- **WHEN** a tree is resolved
- **THEN** the map contains an entry for the root node and for every descendant node reachable through `children` or `freeformElements`

### Requirement: Image slot box resolution
An `imageSlot` node SHALL be assigned a box derived from the space its container gives it, shrunk by the slot's own padding, and SHALL NOT recurse into further children.

#### Scenario: imageSlot receives the box handed to it by its container
- **WHEN** an `imageSlot` node is resolved against an available box and it has no padding configured
- **THEN** its recorded box equals the available box exactly

#### Scenario: imageSlot's own padding shrinks its recorded box
- **WHEN** an `imageSlot` node has `paddingMm` set on one or more sides
- **THEN** its recorded box is inset from the available box by that padding on the corresponding sides

### Requirement: Freeform canvas box delegation
A `freeformCanvas` node SHALL be assigned its full available box without distributing it among children, and each of its freeform elements SHALL be positioned by its own transform relative to that full (unpadded) container box rather than by the layout algorithm.

#### Scenario: freeformCanvas records its full box
- **WHEN** a `freeformCanvas` node is resolved against an available box
- **THEN** its recorded box equals the available box, including the area later reserved for its own padding

#### Scenario: freeform elements are positioned by their transform, not distributed
- **WHEN** a `freeformCanvas` node has one or more `freeformElements`
- **THEN** each element's recorded box is the container box's origin plus that element's `transform.xMm`/`yMm`, sized to `transform.widthMm`/`heightMm`
- **AND** the element's position and size are not affected by sibling elements or by container padding

### Requirement: Grid and flex containers recurse into resolved child boxes
A `grid`, `horizontal`, or `vertical` node SHALL record its own available box, then compute a box for each direct child and recurse the resolution into each child with that box.

#### Scenario: Container node itself keeps the box it was given
- **WHEN** a `grid`, `horizontal`, or `vertical` node is resolved against an available box
- **THEN** its own recorded box in the result map equals the available box it received from its parent (padding is only applied when computing children's boxes, not to the container's own recorded box)

#### Scenario: Grid recurses per cell, flex containers recurse per distributed child
- **WHEN** a `grid` node has children
- **THEN** each child is resolved against the grid cell computed for its position
- **WHEN** a `horizontal` or `vertical` node has children
- **THEN** each child is resolved against the box computed for it by the main/cross-axis distribution

#### Scenario: Container with no children resolves without error
- **WHEN** a `grid`, `horizontal`, or `vertical` node has an empty or missing `children` array
- **THEN** only its own box is recorded and no child boxes are produced

### Requirement: Container padding shrinks the space given to children
Every `grid`, `horizontal`, and `vertical` node SHALL apply its own `paddingMm` (independently per side: top/right/bottom/left) to shrink its available box before computing any child boxes, and this SHALL apply recursively at every depth of nesting.

#### Scenario: Padding insets the box before children are placed
- **WHEN** a container node has `paddingMm` set
- **THEN** the box used to compute its children's positions is inset from the container's available box by that padding on each configured side

#### Scenario: Padding never produces a negative-size box
- **WHEN** a container's configured padding on an axis exceeds the available box's size on that axis
- **THEN** the padded box's width/height on that axis is clamped to zero rather than going negative

#### Scenario: Nested containers each apply their own padding independently
- **WHEN** a `grid` node is a child of a `vertical` node and both have `paddingMm` configured
- **THEN** the grid's cells are inset by both the vertical container's padding (already applied to the grid's incoming box) and the grid's own padding

### Requirement: Gap spacing between adjacent children
Every `grid`, `horizontal`, and `vertical` node SHALL expose a `gapMm` applied as space between adjacent children, and a `grid` node SHALL be able to override it independently per axis via `rowGapMm`/`columnGapMm`.

#### Scenario: gapMm separates adjacent children in a horizontal/vertical container
- **WHEN** a `horizontal` or `vertical` node has more than one child and a `gapMm` value
- **THEN** that gap is inserted along the main axis between each pair of adjacent children, and does not appear before the first child or after the last

#### Scenario: Grid falls back to gapMm when no axis-specific gap is set
- **WHEN** a `grid` node has `gapMm` set but no `gridConfig.rowGapMm`/`columnGapMm`
- **THEN** `gapMm` is used as both the row gap and the column gap

#### Scenario: Grid axis-specific gaps override the shared gap independently
- **WHEN** a `grid` node sets `gridConfig.rowGapMm` and/or `gridConfig.columnGapMm`
- **THEN** the row spacing and column spacing between cells use those values instead of `gapMm`, independently of each other

### Requirement: Horizontal/vertical main-axis distribution
Within a `horizontal` or `vertical` container, a child whose `fixedSizeMm` is set on the container's main axis SHALL receive exactly that size and SHALL be excluded from the flexible pool; the remaining space (after subtracting gaps and fixed sizes) SHALL be split among the remaining children in proportion to their `sizeRatio` (default 1).

#### Scenario: A fixed-size child takes exactly its configured size
- **WHEN** a child of a `horizontal` container has `fixedSizeMm.widthMm` set
- **THEN** that child's main-axis size equals `fixedSizeMm.widthMm`, unaffected by its `sizeRatio`

#### Scenario: Flexible children split remaining space by sizeRatio
- **WHEN** a container has flexible children with `sizeRatio` values 1, 2, and 1, and no fixed-size siblings
- **THEN** the second child's main-axis size is twice that of the first and third children, and the three sizes plus gaps sum to the container's available main-axis size

#### Scenario: Fixed sizes are subtracted before ratio distribution
- **WHEN** one child has a fixed main-axis size and the others are flexible
- **THEN** the flexible children's combined size equals the container's available main-axis size minus the total gap and minus the fixed child's size

#### Scenario: Oversubscribed fixed sizes do not produce negative available space
- **WHEN** the sum of fixed sizes and gaps in a container exceeds the container's available main-axis size
- **THEN** the space available for flexible children is clamped to zero rather than negative

### Requirement: Horizontal/vertical cross-axis alignment
The cross-axis size and offset of each child in a `horizontal`/`vertical` container SHALL be resolved from its `alignment` (left/center/right/top/bottom/expand on the applicable axis), where a `fixedSizeMm` on the cross axis takes priority over `expand`, an `imageSlot`'s own `aspectRatio` provides an intrinsic size when no fixed cross size is set, and — for non-`imageSlot` children with no aspect ratio — the child's own bottom-up minimum required size is used as a shrink-to-fit fallback.

#### Scenario: expand alignment fills the cross axis
- **WHEN** a child's cross-axis alignment is `expand` and it has no `fixedSizeMm` on that axis
- **THEN** the child's cross-axis size equals the container's full cross-axis size, with zero offset

#### Scenario: Fixed cross size overrides expand
- **WHEN** a child has `fixedSizeMm` set on the cross axis, even if its alignment is `expand`
- **THEN** the child's cross-axis size equals that fixed value rather than the full cross size

#### Scenario: imageSlot aspect ratio derives an intrinsic cross size
- **WHEN** an `imageSlot` child has `imageSlotConfig.aspectRatio` set and no fixed cross size, with alignment `center`, `left`/`top`, or `right`/`bottom`
- **THEN** its cross-axis size is derived from its resolved main-axis size and that aspect ratio, capped at the available cross size, and offset according to the alignment (centered, flush to the start edge, or flush to the end edge)

#### Scenario: Nested containers shrink-to-fit using their own minimum content size
- **WHEN** a non-`imageSlot` child (a nested `grid`/`horizontal`/`vertical`) has no `fixedSizeMm` on the cross axis and alignment other than `expand`
- **THEN** its cross-axis size is its own bottom-up minimum required size on that axis, capped at the available cross size

### Requirement: Grid cell computation
A `grid` node SHALL divide its padded box into a uniform grid of `rows` × `columns` cells of equal size, separated by independent row and column gaps, after applying its own padding once.

#### Scenario: Cells are uniform in size
- **WHEN** a grid has a configured number of rows and columns
- **THEN** every cell has the same width and the same height, computed by evenly dividing the padded box minus the total gap space on each axis

#### Scenario: Row and column gaps apply independently between cells
- **WHEN** a grid has distinct row and column gap values
- **THEN** the horizontal space between adjacent cells in the same row uses the column gap, and the vertical space between adjacent cells in the same column uses the row gap

#### Scenario: A grid with no children produces no cells
- **WHEN** a grid node has zero children
- **THEN** no cells are computed and no children are resolved

### Requirement: Grid auto-fit dimension derivation
When a `grid` node's `gridConfig.autoFit` is true, the number of rows and columns SHALL be derived from the child count and the aspect ratio of the box available to the grid, rather than from explicit `rows`/`columns` values.

#### Scenario: autoFit derives columns from child count and box aspect ratio
- **WHEN** `autoFit` is true and the grid has N children with an available box of a given width-to-height ratio
- **THEN** the column count is the ceiling of the square root of (N × box aspect ratio), and the row count is the ceiling of N divided by that column count, each floored at a minimum of 1

#### Scenario: Explicit rows/columns are used when autoFit is false or unset
- **WHEN** `gridConfig.autoFit` is false or omitted
- **THEN** the grid uses `gridConfig.rows` and `gridConfig.columns` directly (each defaulting to 1 if unset), ignoring the box's aspect ratio

### Requirement: freeformCanvas nests at any depth without a dedicated top-level mode
A `freeformCanvas` node SHALL be treated as an ordinary node type by the resolution algorithm: it MAY be the root node, or a child of a `grid`/`horizontal`/`vertical` node at any depth, with no separate code path required for a top-level "Freeform" case.

#### Scenario: freeformCanvas as the root node resolves like any root
- **WHEN** the root node's type is `freeformCanvas`
- **THEN** it is resolved the same way as a `freeformCanvas` appearing anywhere else in the tree — assigned the full available box with its elements delegated to their own transforms

#### Scenario: freeformCanvas nested inside a flex or grid container resolves like any other child
- **WHEN** a `freeformCanvas` node appears as a child of a `horizontal`, `vertical`, or `grid` container
- **THEN** it receives the box computed for its position by that container's distribution/cell logic, exactly as an `imageSlot` or nested container child would

### Requirement: Image fill mode — fitInParent
When an `imageSlot`'s scaling rule is `fitInParent` (the default), the assigned image SHALL be scaled as large as possible within the slot box while preserving its original aspect ratio, without cropping, and centered so any leftover space is split evenly on the sides. This fitting SHALL be computed against the slot's `imageRotationDeg` per the Image rotation orientation requirement, so the on-screen result still fits within the slot's own (un-rotated) box at every rotation value.

#### Scenario: A wider-than-slot image is fit to the slot's width
- **WHEN** the image's aspect ratio is wider than the slot's aspect ratio
- **THEN** the displayed image width equals the slot's width, its height is derived from the image's aspect ratio, and it is vertically centered with equal empty space above and below

#### Scenario: A taller-than-slot image is fit to the slot's height
- **WHEN** the image's aspect ratio is narrower (taller) than the slot's aspect ratio
- **THEN** the displayed image height equals the slot's height, its width is derived from the image's aspect ratio, and it is horizontally centered with equal empty space on both sides

### Requirement: Image fill mode — envelopeParent
When an `imageSlot`'s scaling rule is `envelopeParent`, the source image SHALL be cropped (in the image's own pixel space) to the slot's aspect ratio, positioned according to a normalized focal point (default center), so the result fully covers the slot with no empty space. This crop SHALL be computed against the slot's `imageRotationDeg` per the Image rotation orientation requirement — the target aspect used for cropping is the slot's aspect ratio as seen from the image's own (rotated) orientation — while the focal point SHALL continue to address the source image's own unrotated pixel space.

#### Scenario: A wider-than-target image is cropped on its width
- **WHEN** the source image's aspect ratio is wider than the target aspect ratio
- **THEN** the crop keeps the full source height and reduces the crop width to match the target aspect ratio

#### Scenario: A taller-than-target image is cropped on its height
- **WHEN** the source image's aspect ratio is narrower than the target aspect ratio
- **THEN** the crop keeps the full source width and reduces the crop height to match the target aspect ratio

#### Scenario: Focal point shifts the crop origin without exceeding the source bounds
- **WHEN** a focal point other than the center (0.5, 0.5) is supplied
- **THEN** the crop's top-left offset is shifted proportionally toward that focal point, clamped so the crop rectangle never extends outside the source image

### Requirement: Image fill mode — stretch
When an `imageSlot`'s scaling rule is `stretch`, the image SHALL be resized to exactly fill the slot's width and height independently, ignoring its original aspect ratio, and a distortion warning SHALL be flagged when the relative difference between the image's and the slot's aspect ratios exceeds 15%. Both aspect ratios used for this comparison, and the exact-fill sizing itself, SHALL be computed against the slot's `imageRotationDeg` per the Image rotation orientation requirement, so the on-screen result still exactly fills the slot's own (un-rotated) box at every rotation value.

#### Scenario: Stretched image always matches the slot exactly
- **WHEN** an image is displayed with `stretch`
- **THEN** its displayed width equals the slot's width and its displayed height equals the slot's height, regardless of the image's original aspect ratio

#### Scenario: Large aspect ratio mismatch flags a distortion warning
- **WHEN** the absolute difference between the source aspect ratio and the slot aspect ratio, relative to the source aspect ratio, exceeds 15%
- **THEN** the computed result is flagged with a distortion warning; otherwise it is not

### Requirement: Image fill mode — specificSize
When an `imageSlot`'s scaling rule is `specificSize`, the image SHALL be displayed at the exact millimeter size given by `specificSizeMm`, centered within the slot box, independent of the slot's own resolved size — including when the requested size is larger than the slot, in which case the geometry is not clamped. `specificSizeMm.widthMm`/`heightMm` SHALL always represent the on-screen (post-rotation) footprint the user configured, regardless of the slot's `imageRotationDeg`.

#### Scenario: specificSize centers a fixed-size rectangle within the slot
- **WHEN** an `imageSlot` has `scalingRule: 'specificSize'` with a resolved `specificSizeMm`
- **THEN** the displayed rectangle has exactly that width and height, offset within the slot box so it is centered on both axes

#### Scenario: A requested size larger than the slot is not clamped
- **WHEN** `specificSizeMm.widthMm` or `specificSizeMm.heightMm` exceeds the slot's resolved width or height
- **THEN** the computed offset becomes negative and/or the computed size exceeds the slot box, rather than being reduced to fit — the overflow is left for the caller to flag as a warning

### Requirement: Image rotation orientation
An `imageSlot`'s displayed-rect computation (used by every scaling rule) SHALL account for the slot's `imageRotationDeg`: when `imageRotationDeg` is `90` or `270`, the fit/crop/stretch/size math for that scaling rule SHALL be computed against a box with width and height swapped relative to the slot's own resolved box, then the resulting rect's `widthMm`/`heightMm` (and offset) SHALL be swapped back so they represent the final on-screen, post-rotation footprint within the slot's own (un-swapped) box; when `imageRotationDeg` is `0` or `180`, no axis swap applies. The displayed rect returned to callers SHALL always describe this on-screen footprint — never an intermediate pre-rotation working size — so that both the rendered image and any dimension label derived from the rect are correct at every rotation value without the caller needing rotation-specific logic.

#### Scenario: 90° and 270° rotation swap which slot axis constrains the fit
- **WHEN** an `imageSlot` has `imageRotationDeg` of `90` or `270` and any scaling rule
- **THEN** the fit/crop/stretch/size computation for that rule SHALL be performed as if the slot's width and height were exchanged, and the final returned `widthMm`/`heightMm` SHALL be swapped back so the on-screen result still fits within the slot's actual (un-exchanged) box

#### Scenario: 0° and 180° rotation do not swap axes
- **WHEN** an `imageSlot` has `imageRotationDeg` of `0` or `180`
- **THEN** the fit/crop/stretch/size computation SHALL use the slot's box exactly as resolved, with no width/height axis swap

#### Scenario: The returned display rect always matches what is on screen
- **WHEN** any scaling rule's displayed rect is computed for an `imageSlot` at any `imageRotationDeg`
- **THEN** the returned `widthMm`/`heightMm` SHALL equal the visual, post-rotation footprint of the rendered image — the same values a dimension label overlaid on that slot would show — never the pre-rotation working size used internally by the fit/crop/stretch/size math

#### Scenario: envelopeParent's focal point is unaffected by rotation
- **WHEN** an `imageSlot` uses `envelopeParent` with a non-center focal point and a non-zero `imageRotationDeg`
- **THEN** the focal point SHALL continue to address the source image's own unrotated pixel space exactly as it does at `imageRotationDeg: 0`, with the rotation applied to the cropped result's presentation, not to the focal point's coordinate space

### Requirement: Bottom-up minimum required size
The system SHALL compute, for any node and axis, a minimum required size in millimeters derived bottom-up from its descendants: an `imageSlot`/`freeformCanvas` node's minimum is its own `fixedSizeMm` on that axis (or a flat floor if unset); a `grid` node's minimum on each axis is computed independently by summing per-column and per-row child minimums (not by taking a maximum); and a `horizontal`/`vertical` node's minimum along its own main axis is the sum of its children's minimums plus gaps, while along its cross axis it is the maximum of its children's minimums — each including the node's own padding on that axis.

#### Scenario: Leaf node minimum defaults to a flat floor
- **WHEN** an `imageSlot` or `freeformCanvas` node has no `fixedSizeMm` set on an axis
- **THEN** its minimum required size on that axis is a flat floor value (10mm)

#### Scenario: Leaf node minimum respects an explicit fixed size
- **WHEN** an `imageSlot` or `freeformCanvas` node has `fixedSizeMm` set on an axis
- **THEN** its minimum required size on that axis equals that fixed value

#### Scenario: Grid minimum sums per-column and per-row child minimums independently per axis
- **WHEN** a `grid` node's minimum width is computed
- **THEN** it equals the sum of each column's maximum child-minimum-width, plus the total column gap, plus the grid's own left/right padding — and the minimum height is computed the same way per row, independently (not by taking the larger of the two)

#### Scenario: Horizontal/vertical main-axis minimum sums children along that axis
- **WHEN** a `horizontal` node's minimum width (its main axis) is computed
- **THEN** it equals the sum of each child's minimum width, plus the total gap between children, plus the node's own left/right padding

#### Scenario: Horizontal/vertical cross-axis minimum takes the largest child
- **WHEN** a `horizontal` node's minimum height (its cross axis) is computed
- **THEN** it equals the largest of its children's minimum heights (or the flat floor if larger), plus the node's own top/bottom padding — children are not summed on the cross axis

### Requirement: specificSize contributes to the minimum required size as a clamp, not a lock
For an `imageSlot` whose scaling rule is `specificSize`, the minimum required size on each axis SHALL be at least its resolved `specificSizeMm` for that axis (taking the larger of the specific size, any `fixedSizeMm`, and the flat floor), without marking the adjacent divider as locked.

#### Scenario: specificSize raises the minimum required size
- **WHEN** an `imageSlot` has `scalingRule: 'specificSize'` with a `specificSizeMm` larger than the flat floor and larger than any `fixedSizeMm` on that axis
- **THEN** its minimum required size on that axis equals the `specificSizeMm` value for that axis

### Requirement: Divider lock rule
The divider between two adjacent children of a `horizontal`/`vertical` container SHALL be considered locked — and therefore not draggable — whenever either of the two adjacent children has `fixedSizeMm` set on the container's main axis; a `specificSize` `imageSlot` alone does NOT lock its adjacent divider.

#### Scenario: A fixed-size neighbor locks the divider
- **WHEN** the child immediately before or immediately after a divider has `fixedSizeMm` set on the container's main axis
- **THEN** that divider is reported as locked

#### Scenario: No fixed-size neighbor leaves the divider unlocked
- **WHEN** neither child adjacent to a divider has `fixedSizeMm` set on the container's main axis
- **THEN** that divider is reported as not locked, even if one of the two children uses `specificSize`

### Requirement: Sibling divider drag resize
Dragging the divider between two adjacent children of a `horizontal`/`vertical` container SHALL redistribute `sizeRatio` between exactly those two children — converting the dragged millimeter delta to a ratio delta using the container's current ratio-per-millimeter constant — while leaving every other sibling's `sizeRatio` unchanged, and SHALL clamp the delta so that neither of the two adjacent children shrinks below its own minimum required main-axis size.

#### Scenario: Only the two adjacent siblings change
- **WHEN** a divider between child A and child B is dragged
- **THEN** only A's and B's `sizeRatio` values change; every other sibling's `sizeRatio` is returned unchanged

#### Scenario: The transferred ratio preserves the sum of the two siblings
- **WHEN** a divider drag increases child A's `sizeRatio` by some amount
- **THEN** child B's `sizeRatio` decreases by that same amount, so the pair's combined ratio (and therefore the combined space occupied by the rest of the siblings) is unchanged

#### Scenario: Dragging cannot shrink a sibling below its minimum
- **WHEN** a drag delta would reduce child A's or child B's resolved main-axis size below its own minimum required size
- **THEN** the applied delta is clamped so that sibling's size stops exactly at its minimum, rather than going below it

#### Scenario: A locked divider does not redistribute anything
- **WHEN** `resizeSiblingsByDrag` is invoked for a divider that is locked, or when there is no available flexible space to redistribute
- **THEN** the children array is returned unchanged

### Requirement: Layout feasibility validation
The system SHALL walk a resolved layout tree and, for every node, compare its bottom-up minimum required size on each axis against the box actually assigned to it, producing a warning for every node/axis where the minimum exceeds the assigned size.

#### Scenario: A node whose minimum fits its assigned box produces no warning
- **WHEN** a node's minimum required width and height are both less than or equal to its assigned box's width and height
- **THEN** no warning is produced for that node

#### Scenario: A node whose minimum exceeds its assigned box produces a warning with the shortfall
- **WHEN** a node's minimum required size on an axis exceeds the size it was assigned on that axis
- **THEN** a warning is produced identifying the node, the axis, the required size, and the available size

#### Scenario: Feasibility is checked recursively across the whole tree
- **WHEN** a tree has infeasible nodes at more than one depth
- **THEN** warnings are produced for every such node, not only the first one encountered or only the root

### Requirement: Freeform element position containment
A `freeformCanvas` element's position SHALL be clamped, on every update, so that its rotated bounding box always keeps at least a minimum overlap with the containing `freeformCanvas` node's own box on both axes — accounting for rotation — so it can never be moved fully outside the node and become unreachable.

#### Scenario: An element can be moved partially outside its node
- **WHEN** an element is dragged toward an edge of its containing `freeformCanvas` node
- **THEN** it is allowed to extend beyond that edge as long as at least the minimum overlap (20mm) of its rotated bounding box remains inside the node on that axis

#### Scenario: An element cannot be dragged fully outside its node
- **WHEN** a drag would push an element's rotated bounding box's overlap with the node below the minimum overlap on either axis
- **THEN** the element's position is clamped so the minimum overlap is preserved instead

#### Scenario: Rotation is accounted for when computing the clamped footprint
- **WHEN** an element is rotated away from 0/180 degrees
- **THEN** the bounding box used for the overlap check is the axis-aligned box of the rotated rectangle (wider and/or taller than the unrotated element), not the unrotated width/height

### Requirement: Freeform element minimum size
A `freeformCanvas` element's width and height SHALL each be floored at a minimum size so it can never be scaled down to a size that would make it unreachable or invisible.

#### Scenario: Scaling below the floor is prevented
- **WHEN** a resize gesture would reduce an element's width or height below the minimum size (10mm)
- **THEN** the resulting width/height is clamped to that minimum instead

### Requirement: Simple-mode compatibility check
The system SHALL provide a check for whether a root node tree is representable within the two-level restriction of Simple mode: the root node itself, and — if the root is a container — only direct `imageSlot` children with no children of their own.

#### Scenario: A bare imageSlot root is always compatible
- **WHEN** the root node's type is `imageSlot`
- **THEN** the tree is reported as Simple-mode compatible

#### Scenario: A container root with only imageSlot leaf children is compatible
- **WHEN** the root node is a `grid`/`horizontal`/`vertical`/`freeformCanvas` container whose direct children are all `imageSlot` nodes with no children of their own
- **THEN** the tree is reported as Simple-mode compatible

#### Scenario: A nested container child disqualifies the tree
- **WHEN** any direct child of the root is itself a container, or any child has its own children
- **THEN** the tree is reported as not Simple-mode compatible

### Requirement: Divider drag interaction applies incremental deltas
The editor's divider drag gesture SHALL report the millimeter delta since the previous mouse-move event (not the cumulative delta since the drag started) on every move, and a locked divider SHALL ignore mouse-down entirely so it cannot be dragged.

#### Scenario: Each move event carries only its own incremental delta
- **WHEN** the user drags a divider and the pointer moves multiple times before release
- **THEN** each intermediate callback receives the delta since the immediately preceding position, not the delta since the drag began

#### Scenario: A locked divider ignores drag attempts
- **WHEN** the user presses the mouse button on a divider that is currently locked
- **THEN** no drag gesture starts and no resize callback fires

### Requirement: Hover-triggered dimension labels
Every `imageSlot` box and every freeform element SHALL show its own resolved dimensions in a label when the pointer hovers over it, and — separately — the dimensions of the image actually displayed inside it when the pointer hovers specifically over that displayed image area (not just anywhere in the slot).

#### Scenario: Hovering the slot/element shows its own box dimensions
- **WHEN** the pointer is over an `imageSlot` or freeform element but not necessarily over the displayed image within it
- **THEN** a label showing that box's width and height (in the active unit system) is shown

#### Scenario: Hovering the displayed image shows the image's own displayed dimensions
- **WHEN** the pointer is over the actual displayed image rectangle inside a slot (accounting for letterboxing in `fitInParent`, which can be smaller than the slot)
- **THEN** a second label showing the displayed image's own width and height is shown, distinct from the slot's dimensions

#### Scenario: Hovering empty letterbox space counts as slot hover only
- **WHEN** the pointer is over the empty (letterboxed) region of a `fitInParent` slot, outside the displayed image's own rectangle
- **THEN** only the slot dimension label is shown, not the image dimension label

#### Scenario: specificSize keeps the image label visible without hovering
- **WHEN** a slot's scaling rule is `specificSize` with a resolved size
- **THEN** the image dimension label stays visible regardless of hover state, and is shown with a locked indicator

### Requirement: specificSize overflow visual warning
When a `specificSize` image's requested dimensions exceed the space available in its slot or freeform element, the displayed image SHALL be visually marked so the user can notice the mismatch without needing to inspect numbers.

#### Scenario: Oversized specificSize image is outlined
- **WHEN** `specificSizeMm.widthMm` or `heightMm` exceeds the slot's/element's resolved width or height (beyond a small rounding tolerance)
- **THEN** the displayed image is rendered with a distinct warning outline and an explanatory tooltip

#### Scenario: A satisfied specificSize shows no warning
- **WHEN** the requested `specificSizeMm` fits within the resolved slot/element size
- **THEN** no warning outline or tooltip is shown

### Requirement: Restore aspect ratio action for dual-locked specificSize
When a `specificSize` slot has both axes explicitly set (`lockedAxis: 'both'`) and those two values no longer match the assigned image's own aspect ratio beyond a small tolerance, the properties panel SHALL offer a per-axis action that recomputes that axis from the other axis and the image's aspect ratio, keeping both axes explicit afterward.

#### Scenario: Mismatch beyond tolerance surfaces the restore action
- **WHEN** `lockedAxis` is `'both'` and the height implied by the current width and the assigned image's aspect ratio differs from the current height by more than 0.05mm
- **THEN** a restore-aspect-ratio action is offered for both the width input and the height input

#### Scenario: Restoring from the width action recomputes width from height
- **WHEN** the user triggers the restore action associated with the width input
- **THEN** the width is recomputed as the current height multiplied by the image's aspect ratio, and `lockedAxis` remains `'both'`

#### Scenario: Restoring from the height action recomputes height from width
- **WHEN** the user triggers the restore action associated with the height input
- **THEN** the height is recomputed as the current width divided by the image's aspect ratio, and `lockedAxis` remains `'both'`

#### Scenario: No assigned image means no restore action
- **WHEN** the slot has no image assigned (no aspect ratio to compare against)
- **THEN** neither restore action is shown, regardless of the current width/height values

