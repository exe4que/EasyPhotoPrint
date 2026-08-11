import { describe, expect, it } from 'vitest';

import { computeCoverDecodeSize, computeThumbnailSize } from './thumbnailSize.js';

describe('computeThumbnailSize', () => {
  it('scales a landscape image down so its longer edge is 240px', () => {
    expect(computeThumbnailSize(4000, 2000)).toEqual({ width: 240, height: 120 });
  });

  it('scales a portrait image down so its longer edge is 240px', () => {
    expect(computeThumbnailSize(2000, 4000)).toEqual({ width: 120, height: 240 });
  });

  it('does not upscale an image already smaller than the max edge', () => {
    expect(computeThumbnailSize(100, 50)).toEqual({ width: 100, height: 50 });
  });

  it('throws for non-positive dimensions', () => {
    expect(() => computeThumbnailSize(0, 100)).toThrow();
    expect(() => computeThumbnailSize(100, 0)).toThrow();
  });
});

// Same cases as electron/main/ipc/fs.helpers.test.ts's computeCoverDecodeSize suite, since this
// is a deliberate duplicate of that pure logic (see design.md, Decision 4) -- keeping the cases
// identical is what catches the two ports drifting apart.
describe('computeCoverDecodeSize', () => {
  it('scales a landscape source down, preserving aspect, when the height axis is the binding constraint', () => {
    expect(computeCoverDecodeSize(4000, 2000, 1000, 800)).toEqual({ width: 1600, height: 800 });
  });

  it('scales a portrait source down, preserving aspect, when the width axis is the binding constraint', () => {
    expect(computeCoverDecodeSize(2000, 4000, 800, 1000)).toEqual({ width: 800, height: 1600 });
  });

  it('clamps to the native size instead of upscaling when the requested minimum exceeds it', () => {
    expect(computeCoverDecodeSize(500, 500, 2000, 1000)).toEqual({ width: 500, height: 500 });
  });

  it('scales down aspect-preserving when the requested minimum is smaller than native in both dimensions', () => {
    expect(computeCoverDecodeSize(3000, 2000, 300, 150)).toEqual({ width: 300, height: 200 });
  });

  it('throws for non-positive native dimensions', () => {
    expect(() => computeCoverDecodeSize(0, 100, 10, 10)).toThrow();
    expect(() => computeCoverDecodeSize(100, 0, 10, 10)).toThrow();
  });
});
