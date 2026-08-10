import { describe, expect, it } from 'vitest';

import { computePdfImagePlacement } from './pdfPlacement.js';
import { mmToPt } from './units.js';

/** Independent reconstruction of what `pdf-lib`'s `drawImage` actually does with a placement's
 * x/y/rotate: places the local point (localXPt, localYPt) relative to the unrotated bottom-left
 * anchor, then rotates it counterclockwise around that anchor by rotateDegrees (PDF's own
 * convention) -- used to verify a placement produces the intended visual result, rather than just
 * re-deriving the same formula the implementation uses. */
function rotatedPoint(
  placement: { xPt: number; yPt: number; rotateDegrees: number },
  localXPt: number,
  localYPt: number,
): { x: number; y: number } {
  const rad = (placement.rotateDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: placement.xPt + (localXPt * cos - localYPt * sin),
    y: placement.yPt + (localXPt * sin + localYPt * cos),
  };
}

describe('computePdfImagePlacement', () => {
  it('places an unrotated image centered on the target point', () => {
    const placement = computePdfImagePlacement(50, 50, 100, 20, 10, 0);

    expect(placement.rotateDegrees).toBeCloseTo(0);
    expect(placement.widthPt).toBeCloseTo(mmToPt(20));
    expect(placement.heightPt).toBeCloseTo(mmToPt(10));
    expect(placement.xPt).toBeCloseTo(mmToPt(40));
    expect(placement.yPt).toBeCloseTo(mmToPt(45));
  });

  it('rotates 90 degrees clockwise (matching the DOM/CSS convention), not counterclockwise', () => {
    const placement = computePdfImagePlacement(50, 50, 100, 20, 10, 90);

    // Hand-derived: a 20mm(w) x 10mm(h) rect centered at (50,50)mm, rotated 90 deg clockwise as
    // viewed on the page, becomes a 10mm(w) x 20mm(h) footprint centered at the same point.
    expect(placement.rotateDegrees).toBeCloseTo(-90);
    expect(placement.xPt).toBeCloseTo(mmToPt(45));
    expect(placement.yPt).toBeCloseTo(mmToPt(60));

    // The corner that was top-right in the unrotated local frame (localX = width, localY = height)
    // should land 5mm right / 10mm below the center after a 90deg clockwise turn.
    const corner = rotatedPoint(placement, placement.widthPt, placement.heightPt);
    expect(corner.x).toBeCloseTo(mmToPt(55));
    expect(corner.y).toBeCloseTo(mmToPt(40));
  });

  it('keeps the rotated shape centered on the target point for an arbitrary angle', () => {
    const centerXMm = 30;
    const centerYMm = 70;
    const pageHeightMm = 150;
    const widthMm = 24;
    const heightMm = 16;
    const placement = computePdfImagePlacement(centerXMm, centerYMm, pageHeightMm, widthMm, heightMm, 37);

    const corners = [
      rotatedPoint(placement, 0, 0),
      rotatedPoint(placement, placement.widthPt, 0),
      rotatedPoint(placement, 0, placement.heightPt),
      rotatedPoint(placement, placement.widthPt, placement.heightPt),
    ];
    const centroidX = corners.reduce((sum, c) => sum + c.x, 0) / corners.length;
    const centroidY = corners.reduce((sum, c) => sum + c.y, 0) / corners.length;

    expect(centroidX).toBeCloseTo(mmToPt(centerXMm));
    expect(centroidY).toBeCloseTo(mmToPt(pageHeightMm - centerYMm));

    // Rotation preserves the diagonal half-length from center to each corner.
    const expectedRadiusPt = Math.hypot(mmToPt(widthMm) / 2, mmToPt(heightMm) / 2);
    for (const corner of corners) {
      const radius = Math.hypot(corner.x - centroidX, corner.y - centroidY);
      expect(radius).toBeCloseTo(expectedRadiusPt);
    }
  });
});
