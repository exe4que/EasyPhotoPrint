import { domainToPdfCoords, mmToPt } from './units.js';

export interface PdfImagePlacement {
  /** The x/y `pdf-lib`'s `drawImage` should use -- the position of the image's own bottom-left
   * corner *before* rotation, since `drawImage` rotates around that anchor rather than the
   * image's center. */
  xPt: number;
  yPt: number;
  /** Pre-rotation width/height in PDF points -- always the unrotated size, regardless of `rotateDegrees`. */
  widthPt: number;
  heightPt: number;
  /** The angle to pass to `pdf-lib`'s `rotate: degrees(rotateDegrees)`. `pdf-lib` rotates
   * counterclockwise for positive angles in PDF's own Y-up space; negating `rotationDeg` here
   * converts our clockwise-positive, Y-down domain convention (the same one CSS `rotate()` uses)
   * into that counterclockwise-positive, Y-up one. */
  rotateDegrees: number;
}

/**
 * Given a placed image's absolute center in domain space (mm, Y-down, top-left page origin) and
 * its pre-rotation size, returns the `x`/`y`/`rotate` `pdf-lib`'s `page.drawImage` needs so the
 * rotated image's visual center lands at that same point, rotated `rotationDeg` clockwise (the
 * same visual direction the DOM's `transform: rotate(rotationDeg deg)` already produces) --
 * `pdf-lib` rotates a shape around its own anchor corner, not its center, so the anchor has to be
 * solved for rather than passed through directly.
 */
export function computePdfImagePlacement(
  centerXMm: number,
  centerYMm: number,
  pageHeightMm: number,
  widthMm: number,
  heightMm: number,
  rotationDeg: number,
): PdfImagePlacement {
  const center = domainToPdfCoords({ x: centerXMm, y: centerYMm, w: 0, h: 0 }, pageHeightMm);
  const widthPt = mmToPt(widthMm);
  const heightPt = mmToPt(heightMm);
  const halfWidthPt = widthPt / 2;
  const halfHeightPt = heightPt / 2;

  const rotateDegrees = -rotationDeg;
  const rad = (rotateDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    xPt: center.x - (halfWidthPt * cos - halfHeightPt * sin),
    yPt: center.y - (halfWidthPt * sin + halfHeightPt * cos),
    widthPt,
    heightPt,
    rotateDegrees,
  };
}
