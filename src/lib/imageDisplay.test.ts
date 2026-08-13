import { computeStretch, orientBoxMm, type BoxMm, type ImageAsset, type ImageRotationDeg } from '@epp/layout-engine';
import { describe, expect, it } from 'vitest';

import {
  computeEnvelopeParentPlacementMm,
  computeImageDisplayRectMm,
  computeImageRenderRectMm,
  isSpecificSizeUnsatisfied,
  panEnvelopeParentFocalPoint,
} from './imageDisplay.js';
import { formatLength } from './units.js';

const portraitAsset: ImageAsset = {
  id: 'portrait',
  originalPath: '/tmp/portrait.jpg',
  storedPath: '/tmp/portrait.jpg',
  fileName: 'portrait.jpg',
  widthPx: 200,
  heightPx: 400,
  thumbnailDataUrl: 'data:image/jpeg;base64,AA==',
};

const landscapeAsset: ImageAsset = {
  id: 'landscape',
  originalPath: '/tmp/landscape.jpg',
  storedPath: '/tmp/landscape.jpg',
  fileName: 'landscape.jpg',
  widthPx: 400,
  heightPx: 200,
  thumbnailDataUrl: 'data:image/jpeg;base64,AA==',
};

const landscapeSlot: BoxMm = { x: 0, y: 0, w: 100, h: 50 };

const ALL_ROTATIONS: ImageRotationDeg[] = [0, 90, 180, 270];

describe('computeImageDisplayRectMm — fitInParent across all four rotations', () => {
  it('0deg: fits the portrait image to the slot height, letterboxed horizontally', () => {
    const rect = computeImageDisplayRectMm(portraitAsset, landscapeSlot, 'fitInParent', undefined, 0);
    expect(rect).toEqual({ offsetXMm: 37.5, offsetYMm: 0, widthMm: 25, heightMm: 50 });
  });

  it('90deg: the rotated portrait image (now landscape) exactly fills the landscape slot', () => {
    const rect = computeImageDisplayRectMm(portraitAsset, landscapeSlot, 'fitInParent', undefined, 90);
    expect(rect).toEqual({ offsetXMm: 0, offsetYMm: 0, widthMm: 100, heightMm: 50 });
  });

  it('180deg: identical footprint to 0deg -- only the pixels are upside down, not the geometry', () => {
    const rect = computeImageDisplayRectMm(portraitAsset, landscapeSlot, 'fitInParent', undefined, 180);
    expect(rect).toEqual({ offsetXMm: 37.5, offsetYMm: 0, widthMm: 25, heightMm: 50 });
  });

  it('270deg: identical footprint to 90deg -- same bounding geometry, mirrored pixels', () => {
    const rect = computeImageDisplayRectMm(portraitAsset, landscapeSlot, 'fitInParent', undefined, 270);
    expect(rect).toEqual({ offsetXMm: 0, offsetYMm: 0, widthMm: 100, heightMm: 50 });
  });

  it('omitting rotationDeg matches the 0deg result (backward-compatible default)', () => {
    const withUndefined = computeImageDisplayRectMm(portraitAsset, landscapeSlot, 'fitInParent', undefined);
    const withZero = computeImageDisplayRectMm(portraitAsset, landscapeSlot, 'fitInParent', undefined, 0);
    expect(withUndefined).toEqual(withZero);
  });
});

describe('computeImageDisplayRectMm — envelopeParent and stretch always fill the slot exactly, at every rotation', () => {
  for (const rotationDeg of ALL_ROTATIONS) {
    it(`envelopeParent fills the slot exactly at ${rotationDeg}deg`, () => {
      const rect = computeImageDisplayRectMm(portraitAsset, landscapeSlot, 'envelopeParent', undefined, rotationDeg);
      expect(rect).toEqual({ offsetXMm: 0, offsetYMm: 0, widthMm: landscapeSlot.w, heightMm: landscapeSlot.h });
    });

    it(`stretch fills the slot exactly at ${rotationDeg}deg`, () => {
      const rect = computeImageDisplayRectMm(landscapeAsset, landscapeSlot, 'stretch', undefined, rotationDeg);
      expect(rect).toEqual({ offsetXMm: 0, offsetYMm: 0, widthMm: landscapeSlot.w, heightMm: landscapeSlot.h });
    });
  }
});

describe('computeImageDisplayRectMm — specificSize represents the on-screen size at every rotation', () => {
  const specificSizeMm = { widthMm: 30, heightMm: 80, lockedAxis: 'both' as const };

  for (const rotationDeg of ALL_ROTATIONS) {
    it(`on-screen rect equals specificSizeMm centered in the slot at ${rotationDeg}deg, overflow included`, () => {
      const rect = computeImageDisplayRectMm(portraitAsset, landscapeSlot, 'specificSize', specificSizeMm, rotationDeg);
      // Height (80) exceeds the slot's height (50) -- overflow is not clamped, at any rotation.
      expect(rect).toEqual({ offsetXMm: 35, offsetYMm: -15, widthMm: 30, heightMm: 80 });
    });
  }
});

describe('computeImageRenderRectMm — the pre-rotation working size differs by rotation even when the on-screen size does not', () => {
  it('specificSize: pre-rotation size swaps at 90/270 so the post-rotation footprint stays correct', () => {
    const specificSizeMm = { widthMm: 30, heightMm: 80, lockedAxis: 'both' as const };

    expect(computeImageRenderRectMm(portraitAsset, landscapeSlot, 'specificSize', specificSizeMm, 0)).toEqual({
      widthMm: 30,
      heightMm: 80,
    });
    expect(computeImageRenderRectMm(portraitAsset, landscapeSlot, 'specificSize', specificSizeMm, 90)).toEqual({
      widthMm: 80,
      heightMm: 30,
    });
  });

  it('fitInParent: pre-rotation size is computed against the swapped box at 90/270', () => {
    expect(computeImageRenderRectMm(portraitAsset, landscapeSlot, 'fitInParent', undefined, 0)).toEqual({
      widthMm: 25,
      heightMm: 50,
    });
    expect(computeImageRenderRectMm(portraitAsset, landscapeSlot, 'fitInParent', undefined, 90)).toEqual({
      widthMm: 50,
      heightMm: 100,
    });
  });
});

describe('stretch distortion warning is evaluated against the rotation-swapped aspect ratio', () => {
  // A 2:1 landscape image into a near-square slot: within tolerance unrotated, but rotating the
  // image 90 into the same slot produces a real mismatch -- rotation changes the actual risk of
  // visible distortion, so the warning must be recomputed per-rotation, not reused from 0deg.
  const nearSquareSlot: BoxMm = { x: 0, y: 0, w: 100, h: 58 };

  it('no warning at 0deg', () => {
    expect(computeStretch(landscapeAsset, orientBoxMm(nearSquareSlot, 0)).distortionWarning).toBe(false);
  });

  it('warning at 90deg, for the exact same image and slot', () => {
    expect(computeStretch(landscapeAsset, orientBoxMm(nearSquareSlot, 90)).distortionWarning).toBe(true);
  });
});

describe('isSpecificSizeUnsatisfied compares against the slot\'s real box regardless of rotation', () => {
  // isSpecificSizeUnsatisfied itself has no rotation parameter -- specificSizeMm is always the
  // on-screen size, so the existing (unrotated) comparison is already correct at every rotation.
  it('flags overflow the same way whether or not the slot is conceptually rotated', () => {
    const specificSizeMm = { widthMm: 30, heightMm: 80, lockedAxis: 'both' as const };
    expect(isSpecificSizeUnsatisfied(specificSizeMm, landscapeSlot)).toBe(true);
    expect(isSpecificSizeUnsatisfied(specificSizeMm, orientBoxMm(landscapeSlot, 90))).toBe(false);
  });

  it('does not flag a specific size that fits within the slot', () => {
    const specificSizeMm = { widthMm: 20, heightMm: 20, lockedAxis: 'both' as const };
    expect(isSpecificSizeUnsatisfied(specificSizeMm, landscapeSlot)).toBe(false);
  });
});

describe('computeEnvelopeParentPlacementMm', () => {
  it('matches hand-computed offset and transform-origin for an off-center pan at 0deg', () => {
    const placement = computeEnvelopeParentPlacementMm(portraitAsset, landscapeSlot, { x: 0.5, y: 0 }, 0);
    expect(placement).toEqual({
      leftMm: 0,
      topMm: 0,
      widthMm: 100,
      heightMm: 200,
      transformOriginXMm: 50,
      transformOriginYMm: 25,
    });
  });

  it('reduces to plain center-of-element pivoting at the default center focalPoint, at every rotation', () => {
    for (const rotationDeg of ALL_ROTATIONS) {
      const placement = computeEnvelopeParentPlacementMm(portraitAsset, landscapeSlot, { x: 0.5, y: 0.5 }, rotationDeg);
      expect(placement.transformOriginXMm).toBeCloseTo(placement.widthMm / 2);
      expect(placement.transformOriginYMm).toBeCloseTo(placement.heightMm / 2);
    }
  });

  it('always pivots imageRotationDeg around the slot\'s own center in actual (post-rotation) coordinates, regardless of pan or rotation', () => {
    const focalPoints = [
      { x: 0, y: 0 },
      { x: 0.3, y: 0.9 },
      { x: 1, y: 1 },
    ];
    for (const rotationDeg of ALL_ROTATIONS) {
      for (const focalPoint of focalPoints) {
        const placement = computeEnvelopeParentPlacementMm(landscapeAsset, landscapeSlot, focalPoint, rotationDeg);
        expect(placement.leftMm + placement.transformOriginXMm).toBeCloseTo(landscapeSlot.w / 2);
        expect(placement.topMm + placement.transformOriginYMm).toBeCloseTo(landscapeSlot.h / 2);
      }
    }
  });
});

describe('panEnvelopeParentFocalPoint', () => {
  const squareSlot: BoxMm = { x: 0, y: 0, w: 100, h: 100 };

  it('ignores a drag on the axis the image does not overflow, at 0deg', () => {
    const next = panEnvelopeParentFocalPoint(portraitAsset, landscapeSlot, 0, { x: 0.5, y: 0.5 }, 10, 0);
    expect(next).toEqual({ x: 0.5, y: 0.5 });
  });

  it('moves the overflowing axis proportionally to the drag distance, at 0deg', () => {
    const next = panEnvelopeParentFocalPoint(portraitAsset, landscapeSlot, 0, { x: 0.5, y: 0.5 }, 0, 15);
    // overflowHeightMm is 150 (200 covered - 50 slot); a 15mm drag is 10% of that range.
    expect(next.x).toBe(0.5);
    expect(next.y).toBeCloseTo(0.4);
  });

  it('clamps at the edges instead of overshooting', () => {
    const next = panEnvelopeParentFocalPoint(portraitAsset, landscapeSlot, 0, { x: 0.5, y: 0.9 }, 0, 1000);
    expect(next.y).toBe(0);
  });

  it('defaults the starting focal point to center when the slot has none set yet', () => {
    const next = panEnvelopeParentFocalPoint(portraitAsset, landscapeSlot, 0, undefined, 0, 0);
    expect(next).toEqual({ x: 0.5, y: 0.5 });
  });

  it('remaps which screen axis moves the stored focal point at 90deg, rotating the delta back to unrotated space', () => {
    // Square slot: the portrait asset only overflows the (unrotated) height axis at 90deg.
    const next = panEnvelopeParentFocalPoint(portraitAsset, squareSlot, 90, { x: 0.5, y: 0.5 }, 10, 0);
    expect(next.x).toBe(0.5);
    expect(next.y).not.toBe(0.5);
  });

  it('two half-sized drags land on the same focal point as one full-sized drag (no drift)', () => {
    const oneStep = panEnvelopeParentFocalPoint(portraitAsset, landscapeSlot, 0, { x: 0.5, y: 0.5 }, 0, 30);
    const halfway = panEnvelopeParentFocalPoint(portraitAsset, landscapeSlot, 0, { x: 0.5, y: 0.5 }, 0, 15);
    const twoSteps = panEnvelopeParentFocalPoint(portraitAsset, landscapeSlot, 0, halfway, 0, 15);
    expect(twoSteps.y).toBeCloseTo(oneStep.y);
  });
});

describe('the yellow dimension label text is correct at every rotation', () => {
  // DimensionOverlay's image label is `${formatLength(widthMm)} x ${formatLength(heightMm)}`
  // built directly from computeImageDisplayRectMm's returned width/height (see PageStage.tsx) --
  // this exercises that exact computation and formatting end to end.
  const expectedByRotation: Record<ImageRotationDeg, string> = {
    0: '25.0mm × 50.0mm',
    90: '100.0mm × 50.0mm',
    180: '25.0mm × 50.0mm',
    270: '100.0mm × 50.0mm',
  };

  for (const rotationDeg of ALL_ROTATIONS) {
    it(`fitInParent label reads "${expectedByRotation[rotationDeg]}" at ${rotationDeg}deg`, () => {
      const { widthMm, heightMm } = computeImageDisplayRectMm(portraitAsset, landscapeSlot, 'fitInParent', undefined, rotationDeg);
      const label = `${formatLength(widthMm, 'metric')} × ${formatLength(heightMm, 'metric')}`;
      expect(label).toBe(expectedByRotation[rotationDeg]);
    });
  }

  it('specificSize label reads the same text at every rotation, since it always shows the on-screen size', () => {
    const specificSizeMm = { widthMm: 30, heightMm: 80, lockedAxis: 'both' as const };
    const labels = ALL_ROTATIONS.map((rotationDeg) => {
      const { widthMm, heightMm } = computeImageDisplayRectMm(portraitAsset, landscapeSlot, 'specificSize', specificSizeMm, rotationDeg);
      return `${formatLength(widthMm, 'metric')} × ${formatLength(heightMm, 'metric')}`;
    });
    expect(new Set(labels).size).toBe(1);
    expect(labels[0]).toBe('30.0mm × 80.0mm');
  });
});
