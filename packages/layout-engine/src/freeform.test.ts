import { describe, expect, it } from 'vitest';

import { clampFreeformPosition, computeRotatedAabbMm, MIN_FREEFORM_OVERLAP_MM } from './freeform.js';

describe('computeRotatedAabbMm', () => {
  it('returns the unrotated size at 0deg', () => {
    expect(computeRotatedAabbMm(100, 50, 0)).toEqual({ widthMm: 100, heightMm: 50 });
  });

  it('swaps width/height at 90deg', () => {
    const aabb = computeRotatedAabbMm(100, 50, 90);
    expect(aabb.widthMm).toBeCloseTo(50, 5);
    expect(aabb.heightMm).toBeCloseTo(100, 5);
  });

  it('grows the bounding box for a 45deg rotation', () => {
    const aabb = computeRotatedAabbMm(100, 100, 45);
    expect(aabb.widthMm).toBeGreaterThan(100);
    expect(aabb.heightMm).toBeGreaterThan(100);
  });
});

describe('clampFreeformPosition', () => {
  it('leaves the position untouched when fully inside the node', () => {
    const transform = { xMm: 10, yMm: 10, widthMm: 50, heightMm: 50, rotationDeg: 0 };
    expect(clampFreeformPosition(transform, { w: 200, h: 200 })).toEqual({ xMm: 10, yMm: 10 });
  });

  it('stops the element from being dragged fully outside the node on the right/bottom', () => {
    const transform = { xMm: 500, yMm: 500, widthMm: 50, heightMm: 50, rotationDeg: 0 };
    const clamped = clampFreeformPosition(transform, { w: 200, h: 200 });

    // At least MIN_FREEFORM_OVERLAP_MM of the 50mm-wide element must still overlap the node.
    const overlapX = Math.min(clamped.xMm + 50, 200) - Math.max(clamped.xMm, 0);
    const overlapY = Math.min(clamped.yMm + 50, 200) - Math.max(clamped.yMm, 0);
    expect(overlapX).toBeCloseTo(MIN_FREEFORM_OVERLAP_MM, 5);
    expect(overlapY).toBeCloseTo(MIN_FREEFORM_OVERLAP_MM, 5);
  });

  it('stops the element from being dragged fully outside the node on the left/top', () => {
    const transform = { xMm: -500, yMm: -500, widthMm: 50, heightMm: 50, rotationDeg: 0 };
    const clamped = clampFreeformPosition(transform, { w: 200, h: 200 });

    const overlapX = Math.min(clamped.xMm + 50, 200) - Math.max(clamped.xMm, 0);
    const overlapY = Math.min(clamped.yMm + 50, 200) - Math.max(clamped.yMm, 0);
    expect(overlapX).toBeCloseTo(MIN_FREEFORM_OVERLAP_MM, 5);
    expect(overlapY).toBeCloseTo(MIN_FREEFORM_OVERLAP_MM, 5);
  });

  it('accounts for the larger rotated bounding box, not just the unrotated size', () => {
    const transform = { xMm: 1000, yMm: 10, widthMm: 100, heightMm: 20, rotationDeg: 45 };
    const clamped = clampFreeformPosition(transform, { w: 300, h: 300 });
    const aabb = computeRotatedAabbMm(100, 20, 45);
    const aabbLeft = clamped.xMm + 50 - aabb.widthMm / 2;
    const overlapX = Math.min(aabbLeft + aabb.widthMm, 300) - Math.max(aabbLeft, 0);
    expect(overlapX).toBeCloseTo(MIN_FREEFORM_OVERLAP_MM, 5);
  });

  it('never returns NaN for a degenerate tiny node', () => {
    const transform = { xMm: 0, yMm: 0, widthMm: 500, heightMm: 500, rotationDeg: 0 };
    const clamped = clampFreeformPosition(transform, { w: 10, h: 10 });
    expect(Number.isFinite(clamped.xMm)).toBe(true);
    expect(Number.isFinite(clamped.yMm)).toBe(true);
  });
});
