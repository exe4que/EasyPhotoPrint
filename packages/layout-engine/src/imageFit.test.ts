import { describe, expect, it } from 'vitest';

import { computeEnvelopeCrop, computeFitInParent, computeSpecificSize, computeStretch } from './imageFit.js';
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
});

