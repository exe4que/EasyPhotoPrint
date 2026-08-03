// @spec OPENSPEC.md §4.2 — freeform transform containment (clampFreeformPosition)
import type { FreeformTransform } from './types.js';

/** Minimum mm of a FreeformElement's rotated bounding box that must stay inside its freeformCanvas node. */
export const MIN_FREEFORM_OVERLAP_MM = 20;

/** Minimum width/height (mm) a FreeformElement can be scaled down to. */
export const MIN_FREEFORM_SIZE_MM = 10;

/**
 * Axis-aligned bounding box (mm) of a widthMm x heightMm rectangle rotated by rotationDeg
 * around its own center — the footprint that actually determines overlap with the node.
 */
export function computeRotatedAabbMm(widthMm: number, heightMm: number, rotationDeg: number): { widthMm: number; heightMm: number } {
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    widthMm: widthMm * cos + heightMm * sin,
    heightMm: widthMm * sin + heightMm * cos,
  };
}

/**
 * Clamps a FreeformElement's position so its rotated bounding box always keeps at least
 * `minOverlapMm` inside the freeformCanvas node's own box (§4.2) — otherwise it could be
 * dragged fully outside and become unreachable (no LayoutTree entry to grab it back from).
 * `xMm`/`yMm` and `nodeBoxMm` are both in the node's own local coordinate space (node's
 * top-left is {0, 0}). Only position is clamped; width/height/rotation pass through as-is.
 */
export function clampFreeformPosition(
  transform: Pick<FreeformTransform, 'xMm' | 'yMm' | 'widthMm' | 'heightMm' | 'rotationDeg'>,
  nodeBoxMm: { w: number; h: number },
  minOverlapMm: number = MIN_FREEFORM_OVERLAP_MM,
): { xMm: number; yMm: number } {
  const { widthMm, heightMm, rotationDeg } = transform;
  const aabb = computeRotatedAabbMm(widthMm, heightMm, rotationDeg);
  const centerX = transform.xMm + widthMm / 2;
  const centerY = transform.yMm + heightMm / 2;

  const overlapX = Math.min(minOverlapMm, aabb.widthMm, nodeBoxMm.w);
  const overlapY = Math.min(minOverlapMm, aabb.heightMm, nodeBoxMm.h);

  const minCenterX = -aabb.widthMm / 2 + overlapX;
  const maxCenterX = nodeBoxMm.w + aabb.widthMm / 2 - overlapX;
  const minCenterY = -aabb.heightMm / 2 + overlapY;
  const maxCenterY = nodeBoxMm.h + aabb.heightMm / 2 - overlapY;

  const clampedCenterX = Math.min(Math.max(centerX, minCenterX), maxCenterX);
  const clampedCenterY = Math.min(Math.max(centerY, minCenterY), maxCenterY);

  return {
    xMm: clampedCenterX - widthMm / 2,
    yMm: clampedCenterY - heightMm / 2,
  };
}
