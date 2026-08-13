import type { BoxMm, EnvelopeCrop, FitInParentBox, FocalPoint, ImageAsset, ImageRotationDeg, SpecificSizeMm, StretchResult } from './types.js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Swaps a box's width/height when the rotation is 90 or 270 -- feeding this swapped box into the
 * existing fit/crop/stretch/size math reorients their result without those functions needing any
 * rotation-specific logic of their own. Callers are responsible for swapping the *result* back.
 */
export function orientBoxMm(box: BoxMm, rotationDeg: ImageRotationDeg | undefined): BoxMm {
  if (rotationDeg === 90 || rotationDeg === 270) {
    return { ...box, w: box.h, h: box.w };
  }
  return box;
}

export function computeEnvelopeCrop(
  asset: ImageAsset,
  targetAspect: number,
  focalPoint = { x: 0.5, y: 0.5 },
): EnvelopeCrop {
  if (targetAspect <= 0) {
    return {
      left: 0,
      top: 0,
      width: asset.widthPx,
      height: asset.heightPx,
    };
  }

  const sourceAspect = asset.widthPx / asset.heightPx;
  let cropWidth = asset.widthPx;
  let cropHeight = asset.heightPx;

  if (sourceAspect > targetAspect) {
    cropWidth = asset.heightPx * targetAspect;
  } else {
    cropHeight = asset.widthPx / targetAspect;
  }

  return {
    left: clamp((asset.widthPx - cropWidth) * focalPoint.x, 0, asset.widthPx - cropWidth),
    top: clamp((asset.heightPx - cropHeight) * focalPoint.y, 0, asset.heightPx - cropHeight),
    width: cropWidth,
    height: cropHeight,
  };
}

export function computeFitInParent(asset: ImageAsset, slotBoxMm: BoxMm): FitInParentBox {
  const sourceAspect = asset.widthPx / asset.heightPx;
  const slotAspect = slotBoxMm.w / slotBoxMm.h;
  const fittedSize =
    sourceAspect > slotAspect
      ? { widthMm: slotBoxMm.w, heightMm: slotBoxMm.w / sourceAspect }
      : { widthMm: slotBoxMm.h * sourceAspect, heightMm: slotBoxMm.h };

  return {
    offsetXMm: (slotBoxMm.w - fittedSize.widthMm) / 2,
    offsetYMm: (slotBoxMm.h - fittedSize.heightMm) / 2,
    widthMm: fittedSize.widthMm,
    heightMm: fittedSize.heightMm,
  };
}

/**
 * `specificSizeMm.widthMm`/`heightMm` are already fully resolved (never partial — see
 * SpecificSizeMm) so this is pure geometry, unlike the other imageFit functions it doesn't
 * need the ImageAsset at all. Centers the fixed-size image within the slot; if the slot is
 * smaller than the requested size on either axis the result overflows the slot — the caller
 * decides how to flag that (§4.1.1 red outline requirement).
 */
export function computeSpecificSize(specificSizeMm: SpecificSizeMm, slotBoxMm: BoxMm): FitInParentBox {
  return {
    offsetXMm: (slotBoxMm.w - specificSizeMm.widthMm) / 2,
    offsetYMm: (slotBoxMm.h - specificSizeMm.heightMm) / 2,
    widthMm: specificSizeMm.widthMm,
    heightMm: specificSizeMm.heightMm,
  };
}

/**
 * The on-screen counterpart to `computeEnvelopeCrop`: instead of a pixel crop rectangle, this
 * returns the mm-space box for an *uncropped* `<img>` element sized to fully cover `slotBoxMm`
 * (matching the source's own aspect ratio, so no `object-fit` is needed) and positioned so a
 * `slotBoxMm`-sized `overflow: hidden` viewport around it shows exactly the crop `focalPoint`
 * selects. `offsetXMm`/`offsetYMm` are always `<= 0` (the covering image only ever needs to shift
 * left/up to reveal its right/bottom edge, never shrink) and their magnitude is bounded by how
 * much the covering size overflows the slot on that axis -- at `focalPoint` 0 the offset is 0
 * (showing the source's own top-left edge), at 1 it's the full overflow (showing the bottom-right
 * edge), mirroring `computeEnvelopeCrop`'s `left`/`top` convention exactly.
 */
export function computeEnvelopeParent(asset: ImageAsset, slotBoxMm: BoxMm, focalPoint: FocalPoint = { x: 0.5, y: 0.5 }): FitInParentBox {
  const sourceAspect = asset.widthPx / asset.heightPx;
  const slotAspect = slotBoxMm.w / slotBoxMm.h;
  const coveredSize =
    sourceAspect > slotAspect
      ? { widthMm: slotBoxMm.h * sourceAspect, heightMm: slotBoxMm.h }
      : { widthMm: slotBoxMm.w, heightMm: slotBoxMm.w / sourceAspect };

  const overflowWidthMm = coveredSize.widthMm - slotBoxMm.w;
  const overflowHeightMm = coveredSize.heightMm - slotBoxMm.h;
  const clampedFocalX = clamp(focalPoint.x, 0, 1);
  const clampedFocalY = clamp(focalPoint.y, 0, 1);

  return {
    // `|| 0` normalizes the `-0` that `-overflow * focal` produces whenever either factor is 0
    // (no overflow on this axis, or focalPoint sitting exactly at 0) -- a real offset is never
    // `-0` (only ever a genuine negative or exactly `0`), so this can't mask an actual value.
    offsetXMm: -overflowWidthMm * clampedFocalX || 0,
    offsetYMm: -overflowHeightMm * clampedFocalY || 0,
    widthMm: coveredSize.widthMm,
    heightMm: coveredSize.heightMm,
  };
}

export function computeStretch(asset: ImageAsset, slotBoxMm: BoxMm): StretchResult {
  const sourceAspect = asset.widthPx / asset.heightPx;
  const slotAspect = slotBoxMm.w / slotBoxMm.h;
  const aspectDelta = Math.abs(sourceAspect - slotAspect) / sourceAspect;

  return {
    widthMm: slotBoxMm.w,
    heightMm: slotBoxMm.h,
    distortionWarning: aspectDelta > 0.15,
  };
}

