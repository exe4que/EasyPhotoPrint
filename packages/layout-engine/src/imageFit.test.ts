import { describe, expect, it } from 'vitest';

import { computeEnvelopeCrop, computeEnvelopeParent, computeFitInParent, computeSpecificSize, computeStretch, orientBoxMm } from './imageFit.js';
import type { ImageAsset } from './types.js';

const asset: ImageAsset = {
  id: 'asset-1',
  originalPath: '/tmp/original.jpg',
  storedPath: '/tmp/stored.jpg',
  fileName: 'photo.jpg',
  widthPx: 4000,
  heightPx: 2000,
  thumbnailDataUrl: 'data:image/jpeg;base64,AA==',
};

describe('imageFit', () => {
  it('computes a cover crop around the focal point', () => {
    expect(computeEnvelopeCrop(asset, 1, { x: 0.5, y: 0.5 })).toEqual({
      left: 1000,
      top: 0,
      width: 2000,
      height: 2000,
    });
  });

  it('fits an image inside the slot without cropping', () => {
    expect(computeFitInParent(asset, { x: 0, y: 0, w: 100, h: 100 })).toEqual({
      offsetXMm: 0,
      offsetYMm: 25,
      widthMm: 100,
      heightMm: 50,
    });
  });

  it('reports distortion for stretch when aspect ratios diverge', () => {
    expect(computeStretch(asset, { x: 0, y: 0, w: 100, h: 100 }).distortionWarning).toBe(true);
  });

  it('centers a specific size inside a larger slot', () => {
    expect(
      computeSpecificSize({ widthMm: 60, heightMm: 40, lockedAxis: 'both' }, { x: 0, y: 0, w: 100, h: 100 }),
    ).toEqual({
      offsetXMm: 20,
      offsetYMm: 30,
      widthMm: 60,
      heightMm: 40,
    });
  });

  it('produces a negative offset (overflow) when the slot is smaller than the specific size', () => {
    const rect = computeSpecificSize({ widthMm: 120, heightMm: 40, lockedAxis: 'width' }, { x: 0, y: 0, w: 100, h: 100 });
    expect(rect.widthMm).toBe(120);
    expect(rect.offsetXMm).toBe(-10);
  });

  it('covers a square slot with the wider-than-target asset, centered by default', () => {
    expect(computeEnvelopeParent(asset, { x: 0, y: 0, w: 100, h: 100 })).toEqual({
      offsetXMm: -50,
      offsetYMm: 0,
      widthMm: 200,
      heightMm: 100,
    });
  });

  it('shifts the covering image to the source edge at focalPoint 0 and 1', () => {
    expect(computeEnvelopeParent(asset, { x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0 })).toEqual({
      offsetXMm: 0,
      offsetYMm: 0,
      widthMm: 200,
      heightMm: 100,
    });
    expect(computeEnvelopeParent(asset, { x: 0, y: 0, w: 100, h: 100 }, { x: 1, y: 1 })).toEqual({
      offsetXMm: -100,
      offsetYMm: 0,
      widthMm: 200,
      heightMm: 100,
    });
  });

  it('never offsets an axis the covering image does not overflow', () => {
    const rect = computeEnvelopeParent(asset, { x: 0, y: 0, w: 100, h: 100 }, { x: 0.3, y: 0.9 });
    expect(rect.offsetYMm).toBe(0);
  });
});

describe('orientBoxMm', () => {
  const box = { x: 5, y: 5, w: 100, h: 50 };

  it('swaps width/height at 90 and 270', () => {
    expect(orientBoxMm(box, 90)).toEqual({ x: 5, y: 5, w: 50, h: 100 });
    expect(orientBoxMm(box, 270)).toEqual({ x: 5, y: 5, w: 50, h: 100 });
  });

  it('leaves the box unchanged at 0, 180, and undefined', () => {
    expect(orientBoxMm(box, 0)).toEqual(box);
    expect(orientBoxMm(box, 180)).toEqual(box);
    expect(orientBoxMm(box, undefined)).toEqual(box);
  });
});

describe('computeEnvelopeCrop with a rotation-aware target aspect', () => {
  // A rotation-aware caller derives targetAspect from the box orientBoxMm would produce for the
  // slot's imageRotationDeg -- computeEnvelopeCrop itself has no rotation concept of its own.
  it('a caller passing the 90/270-swapped target aspect gets a correspondingly different crop', () => {
    const slotBox = { x: 0, y: 0, w: 200, h: 100 };

    const unrotatedAspect = slotBox.w / slotBox.h;
    expect(computeEnvelopeCrop(asset, unrotatedAspect, { x: 0.5, y: 0.5 })).toEqual({
      left: 0,
      top: 0,
      width: 4000,
      height: 2000,
    });

    const rotated90Box = orientBoxMm(slotBox, 90);
    const rotated90Aspect = rotated90Box.w / rotated90Box.h;
    expect(computeEnvelopeCrop(asset, rotated90Aspect, { x: 0.5, y: 0.5 })).toEqual({
      left: 1500,
      top: 0,
      width: 1000,
      height: 2000,
    });

    // 90 and 270 swap the same way -- the crop geometry is identical, only the caller's CSS
    // rotation angle differs between them.
    const rotated270Box = orientBoxMm(slotBox, 270);
    expect(rotated270Box).toEqual(rotated90Box);
  });

  it("the focal point still addresses the source image's own unrotated pixel space at any rotation", () => {
    const slotBox = { x: 0, y: 0, w: 200, h: 100 };
    const rotatedAspect = orientBoxMm(slotBox, 90).w / orientBoxMm(slotBox, 90).h;

    const topLeftFocus = computeEnvelopeCrop(asset, rotatedAspect, { x: 0, y: 0 });
    expect(topLeftFocus.left).toBe(0);
    expect(topLeftFocus.top).toBe(0);

    const bottomRightFocus = computeEnvelopeCrop(asset, rotatedAspect, { x: 1, y: 1 });
    expect(bottomRightFocus.left).toBe(asset.widthPx - bottomRightFocus.width);
    expect(bottomRightFocus.top).toBe(asset.heightPx - bottomRightFocus.height);
  });
});

