import {
  computeEnvelopeParent,
  computeFitInParent,
  computeSpecificSize,
  orientBoxMm,
  type BoxMm,
  type FocalPoint,
  type ImageAsset,
  type ImageRotationDeg,
  type ScalingRule,
  type SpecificSizeMm,
} from '@epp/layout-engine';

/**
 * `specificSize` and `envelopeParent` are both intentionally absent here: `specificSize` uses the
 * rect-based `computeImageRenderRectMm` positioning instead of `object-fit` entirely once
 * `specificSizeMm` is resolved (falling through to `contain` only in the brief window before the
 * user has typed a width/height, to keep the image at its natural aspect ratio rather than
 * stretching it), and `envelopeParent` uses `computeEnvelopeParentPlacementMm`'s explicit,
 * focal-point-aware rect so it can be panned — plain `object-fit: cover` has no way to express an
 * off-center crop.
 */
export function scalingRuleToObjectFit(scalingRule: ScalingRule | undefined): 'contain' | 'fill' {
  switch (scalingRule) {
    case 'stretch':
      return 'fill';
    default:
      return 'contain';
  }
}

function swapSpecificSizeMm(specificSizeMm: SpecificSizeMm): SpecificSizeMm {
  return { ...specificSizeMm, widthMm: specificSizeMm.heightMm, heightMm: specificSizeMm.widthMm };
}

/**
 * The *pre-rotation* size to render the `<img>` element at: fit/crop/stretch/size math computed
 * against the slot box with width/height swapped for a 90/270 `imageRotationDeg` (unchanged for
 * 0/180). Every scaling rule's result is always centered within whatever box it's computed
 * against, so the caller only needs this size — position the element centered on the slot's own
 * center point, then apply `transform: rotate(imageRotationDeg)`; the rotated bounding box lands
 * exactly on the slot with no further offset math required.
 */
export function computeImageRenderRectMm(
  asset: ImageAsset,
  slotBox: BoxMm,
  scalingRule: ScalingRule | undefined,
  specificSizeMm: SpecificSizeMm | undefined,
  rotationDeg: ImageRotationDeg | undefined,
): { widthMm: number; heightMm: number } {
  const orientedBox = orientBoxMm(slotBox, rotationDeg);
  const rotated = rotationDeg === 90 || rotationDeg === 270;

  if (scalingRule === 'specificSize' && specificSizeMm) {
    const orientedSize = rotated ? swapSpecificSizeMm(specificSizeMm) : specificSizeMm;
    const rect = computeSpecificSize(orientedSize, orientedBox);
    return { widthMm: rect.widthMm, heightMm: rect.heightMm };
  }
  if (scalingRule === 'fitInParent' || scalingRule == null) {
    const rect = computeFitInParent(asset, orientedBox);
    return { widthMm: rect.widthMm, heightMm: rect.heightMm };
  }
  // envelopeParent / stretch always fill their box exactly (via CSS object-fit at render time).
  return { widthMm: orientedBox.w, heightMm: orientedBox.h };
}

export interface EnvelopeParentPlacementMm {
  leftMm: number;
  topMm: number;
  widthMm: number;
  heightMm: number;
  /** Relative to the element's own top-left (not the slot's) -- where CSS `transform-origin` must
   * pivot `imageRotationDeg`'s rotation. See this function's own doc comment for why. */
  transformOriginXMm: number;
  transformOriginYMm: number;
}

/**
 * The on-screen placement for an `envelopeParent` `<img>` element -- deliberately *not* folded
 * into `computeImageRenderRectMm`, whose envelopeParent case returns the slot's own (post-crop)
 * size for its PDF/print caller, which crops the actual bitmap pixels first via
 * `computeEnvelopeCrop` and then draws the already-cropped result at exactly the slot's size. The
 * DOM has no equivalent pixel-cropping step: instead, an `overflow: hidden` slot box clips an
 * *uncropped* `<img>` sized to fully cover it (matching the source's own aspect ratio) and
 * positioned by `focalPoint` -- `computeEnvelopeParent` computes exactly that oversized, offset
 * box, in the same pre-rotation ("oriented") working space every other scaling rule here uses.
 *
 * Every other rule's content is always centered within that oriented space, so its own center
 * coincides with the oriented box's center -- which is also, not coincidentally, the point that
 * must land on the slot's actual center for `transform: rotate()` with the CSS default
 * `transform-origin: center` (the *element's own* center) to rotate it correctly. A panned
 * envelopeParent image is off-center by construction, so its own center is no longer that pivot
 * point -- rotating around the element's own center would rotate around the wrong point, visibly
 * swinging the crop around as `imageRotationDeg` changes instead of just spinning the fixed crop
 * in place. This computes an explicit `transform-origin` (in mm, relative to the element's own
 * top-left) at the oriented box's center instead, so the rotation pivots correctly regardless of
 * how far off-center the pan is -- and reduces to the exact same numbers the centered case already
 * used when `focalPoint` is `{ 0.5, 0.5 }` (its own center and the oriented box's center coincide
 * again there), so this generalizes rather than special-cases the default.
 */
export function computeEnvelopeParentPlacementMm(
  asset: ImageAsset,
  slotBox: BoxMm,
  focalPoint: FocalPoint | undefined,
  rotationDeg: ImageRotationDeg | undefined,
): EnvelopeParentPlacementMm {
  const orientedBox = orientBoxMm(slotBox, rotationDeg);
  const content = computeEnvelopeParent(asset, orientedBox, focalPoint);

  return {
    widthMm: content.widthMm,
    heightMm: content.heightMm,
    leftMm: slotBox.w / 2 - orientedBox.w / 2 + content.offsetXMm,
    topMm: slotBox.h / 2 - orientedBox.h / 2 + content.offsetYMm,
    transformOriginXMm: orientedBox.w / 2 - content.offsetXMm,
    transformOriginYMm: orientedBox.h / 2 - content.offsetYMm,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Applies one incremental pointer-drag step (in screen-space mm, i.e. already zoom-corrected but
 * *not* rotation-corrected) to an `envelopeParent` slot's `focalPoint`, returning the next value.
 *
 * `focalPoint` always addresses the source image's own *unrotated* pixel space (see
 * `layout-engine`'s "envelopeParent's focal point is unaffected by rotation" requirement) while
 * the user drags in on-screen (rotated) space -- so a screen-space delta is first rotated back into
 * that unrotated space (the exact inverse of the `imageRotationDeg` CSS rotation the image itself
 * is drawn with) before being scaled into a focal-point delta. Screen dragging then always tracks
 * the pointer the way it visually looks, at every rotation, rather than only feeling correct at 0°.
 *
 * The scale from an unrotated-space mm delta to a focal-point delta is `1 / overflow` on each axis
 * (the same `overflow` `computeEnvelopeParent` derives internally) -- dragging across the image's
 * *entire* pannable range moves `focalPoint` from one clamped end to the other. An axis with no
 * overflow (the covering image doesn't overflow the slot there) never moves, by construction.
 */
export function panEnvelopeParentFocalPoint(
  asset: ImageAsset,
  slotBox: BoxMm,
  rotationDeg: ImageRotationDeg | undefined,
  currentFocalPoint: FocalPoint | undefined,
  deltaScreenXMm: number,
  deltaScreenYMm: number,
): FocalPoint {
  const orientedBox = orientBoxMm(slotBox, rotationDeg);
  const coveredSize = computeEnvelopeParent(asset, orientedBox);
  const overflowWidthMm = coveredSize.widthMm - orientedBox.w;
  const overflowHeightMm = coveredSize.heightMm - orientedBox.h;

  // Inverse of the clockwise, y-down `rotate(rotationDeg)` CSS transform the image is drawn with:
  // rotating a screen-space delta by -rotationDeg recovers the same delta in the image's own
  // unrotated ("oriented") space that focalPoint addresses.
  let deltaLocalXMm = deltaScreenXMm;
  let deltaLocalYMm = deltaScreenYMm;
  if (rotationDeg === 90) {
    deltaLocalXMm = deltaScreenYMm;
    deltaLocalYMm = -deltaScreenXMm;
  } else if (rotationDeg === 180) {
    deltaLocalXMm = -deltaScreenXMm;
    deltaLocalYMm = -deltaScreenYMm;
  } else if (rotationDeg === 270) {
    deltaLocalXMm = -deltaScreenYMm;
    deltaLocalYMm = deltaScreenXMm;
  }

  const currentX = currentFocalPoint?.x ?? 0.5;
  const currentY = currentFocalPoint?.y ?? 0.5;
  const deltaFocalX = overflowWidthMm > 0 ? -deltaLocalXMm / overflowWidthMm : 0;
  const deltaFocalY = overflowHeightMm > 0 ? -deltaLocalYMm / overflowHeightMm : 0;

  return {
    x: clamp01(currentX + deltaFocalX),
    y: clamp01(currentY + deltaFocalY),
  };
}

/**
 * The on-screen rectangle (relative to the slot's own box) where the image is actually painted,
 * already accounting for `imageRotationDeg` — this is the *visual*, post-rotation footprint (the
 * same values a dimension label overlaid on the slot would show), never a pre-rotation working
 * size. For `specificSize`, this can extend outside the slot's own bounds (negative offset / size
 * larger than the slot) when the template can't honor the requested size — callers decide how to
 * flag that (§4.1.1 red outline requirement).
 */
export function computeImageDisplayRectMm(
  asset: ImageAsset,
  slotBox: BoxMm,
  scalingRule: ScalingRule | undefined,
  specificSizeMm?: SpecificSizeMm,
  rotationDeg?: ImageRotationDeg,
): { offsetXMm: number; offsetYMm: number; widthMm: number; heightMm: number } {
  const renderRect = computeImageRenderRectMm(asset, slotBox, scalingRule, specificSizeMm, rotationDeg);
  const rotated = rotationDeg === 90 || rotationDeg === 270;
  const widthMm = rotated ? renderRect.heightMm : renderRect.widthMm;
  const heightMm = rotated ? renderRect.widthMm : renderRect.heightMm;

  return {
    widthMm,
    heightMm,
    offsetXMm: (slotBox.w - widthMm) / 2,
    offsetYMm: (slotBox.h - heightMm) / 2,
  };
}

/** Whether the slot's assigned box is too small to honor the requested specific size on either axis. */
export function isSpecificSizeUnsatisfied(specificSizeMm: SpecificSizeMm | undefined, slotBox: BoxMm): boolean {
  if (!specificSizeMm) {
    return false;
  }
  const EPSILON_MM = 0.1;
  return specificSizeMm.widthMm > slotBox.w + EPSILON_MM || specificSizeMm.heightMm > slotBox.h + EPSILON_MM;
}
