## MODIFIED Requirements

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

## ADDED Requirements

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
