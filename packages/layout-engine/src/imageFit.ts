import type { BoxMm, EnvelopeCrop, FitInParentBox, ImageAsset, SpecificSizeMm, StretchResult } from './types.js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

