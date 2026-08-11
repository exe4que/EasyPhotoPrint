/** Ported from `electron/main/ipc/fs.handlers.ts`/`fs.helpers.ts` -- pure sizing math with no
 * `nativeImage`/Node dependency, so it's duplicated here rather than imported across the
 * Electron/renderer boundary (see design.md, Decision 4). Kept in sync with the Electron
 * originals by the shared test cases in `thumbnailSize.test.ts`. */

export const MAX_THUMBNAIL_EDGE_PX = 240;

/** The largest size, preserving the source's own aspect ratio, whose longer edge does not exceed
 * MAX_THUMBNAIL_EDGE_PX -- never upscales past the source's native resolution. */
export function computeThumbnailSize(widthPx: number, heightPx: number): { width: number; height: number } {
  if (widthPx <= 0 || heightPx <= 0) {
    throw new Error('Image dimensions must be positive.');
  }

  const scale = Math.min(1, MAX_THUMBNAIL_EDGE_PX / Math.max(widthPx, heightPx));
  return {
    width: Math.max(1, Math.round(widthPx * scale)),
    height: Math.max(1, Math.round(heightPx * scale)),
  };
}

/** The smallest size, preserving the source's own aspect ratio, whose width and height are both
 * at least (minWidthPx, minHeightPx) -- the inverse of a "fit under a max edge" thumbnail size:
 * this finds the smallest size that still *covers* a minimum in both axes, never upscaling past
 * the source's native resolution. */
export function computeCoverDecodeSize(
  nativeWidthPx: number,
  nativeHeightPx: number,
  minWidthPx: number,
  minHeightPx: number,
): { width: number; height: number } {
  if (nativeWidthPx <= 0 || nativeHeightPx <= 0) {
    throw new Error('Native image dimensions must be positive.');
  }

  const scale = Math.min(1, Math.max(minWidthPx / nativeWidthPx, minHeightPx / nativeHeightPx));
  return {
    width: Math.max(1, Math.round(nativeWidthPx * scale)),
    height: Math.max(1, Math.round(nativeHeightPx * scale)),
  };
}
