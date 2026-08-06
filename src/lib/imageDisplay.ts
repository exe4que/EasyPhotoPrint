import {
  computeFitInParent,
  computeSpecificSize,
  orientBoxMm,
  type BoxMm,
  type ImageAsset,
  type ImageRotationDeg,
  type ScalingRule,
  type SpecificSizeMm,
} from '@epp/layout-engine';

/**
 * `specificSize` is intentionally absent here: whenever `specificSizeMm` is actually resolved,
 * callers use the rect-based `computeImageDisplayRectMm` positioning instead of `object-fit`
 * entirely. This function is only ever consulted for a `specificSize` slot in the brief window
 * before the user has typed a width/height — falling through to `contain` there keeps the
 * image at its natural aspect ratio instead of stretching it to fill the slot.
 */
export function scalingRuleToObjectFit(scalingRule: ScalingRule | undefined): 'contain' | 'cover' | 'fill' {
  switch (scalingRule) {
    case 'envelopeParent':
      return 'cover';
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
