## MODIFIED Requirements

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
