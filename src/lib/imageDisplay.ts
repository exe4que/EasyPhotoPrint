// @spec OPENSPEC.md §4.1 — shared imageSlot rendering helpers (hover dimension labels, object-fit)
import { computeFitInParent, type BoxMm, type ImageAsset, type ScalingRule } from '@epp/layout-engine';

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

/** The rectangle (relative to the slot's own box) where the image is actually painted. */
export function computeImageDisplayRectMm(
  asset: ImageAsset,
  slotBox: BoxMm,
  scalingRule: ScalingRule | undefined,
): { offsetXMm: number; offsetYMm: number; widthMm: number; heightMm: number } {
  if (scalingRule === 'fitInParent' || scalingRule == null) {
    return computeFitInParent(asset, slotBox);
  }
  return { offsetXMm: 0, offsetYMm: 0, widthMm: slotBox.w, heightMm: slotBox.h };
}
