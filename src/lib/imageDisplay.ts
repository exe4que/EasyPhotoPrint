// @spec OPENSPEC.md §4.1, §4.1.1.1 — shared imageSlot rendering helpers (hover dimension labels, object-fit, specific size)
import { computeFitInParent, computeSpecificSize, type BoxMm, type ImageAsset, type ScalingRule, type SpecificSizeMm } from '@epp/layout-engine';

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

/**
 * The rectangle (relative to the slot's own box) where the image is actually painted. For
 * `specificSize`, this can extend outside the slot's own bounds (negative offset / size larger
 * than the slot) when the template can't honor the requested size — callers decide how to flag
 * that (§4.1.1 red outline requirement).
 */
export function computeImageDisplayRectMm(
  asset: ImageAsset,
  slotBox: BoxMm,
  scalingRule: ScalingRule | undefined,
  specificSizeMm?: SpecificSizeMm,
): { offsetXMm: number; offsetYMm: number; widthMm: number; heightMm: number } {
  if (scalingRule === 'specificSize' && specificSizeMm) {
    return computeSpecificSize(specificSizeMm, slotBox);
  }
  if (scalingRule === 'fitInParent' || scalingRule == null) {
    return computeFitInParent(asset, slotBox);
  }
  return { offsetXMm: 0, offsetYMm: 0, widthMm: slotBox.w, heightMm: slotBox.h };
}

/** Whether the slot's assigned box is too small to honor the requested specific size on either axis. */
export function isSpecificSizeUnsatisfied(specificSizeMm: SpecificSizeMm | undefined, slotBox: BoxMm): boolean {
  if (!specificSizeMm) {
    return false;
  }
  const EPSILON_MM = 0.1;
  return specificSizeMm.widthMm > slotBox.w + EPSILON_MM || specificSizeMm.heightMm > slotBox.h + EPSILON_MM;
}
