import { useEffect, useState } from 'react';

import type { ImageAsset } from '@epp/layout-engine';

import { getEppApi } from '../lib/platform/contract.js';
import { mmToPx } from '../lib/units.js';

/** Session-lifetime cache, keyed by (file, target size) -- decoding is requested at most once per
 * distinct image+size actually previewed, not per render or per page visit. */
const printResolutionCache = new Map<string, string>();

/**
 * Requests (and caches) a print-resolution decode of `asset` sized to cover (widthMm, heightMm)
 * at `dpi` -- returns undefined until one is ready (or if `asset` is missing), so callers can
 * fall back to the asset's own bounded-edge `thumbnailDataUrl` while it loads. The returned value
 * is always read straight from the cache at render time (never from stale component state), so it
 * can't go stale if the same hook instance is reused for a different asset/size across renders.
 */
export function usePrintResolutionSrc(asset: ImageAsset, widthMm: number, heightMm: number, dpi: number): string | undefined {
  const minWidthPx = mmToPx(widthMm, 1, dpi);
  const minHeightPx = mmToPx(heightMm, 1, dpi);
  const cacheKey = `${asset.storedPath}::${Math.round(minWidthPx)}x${Math.round(minHeightPx)}`;
  const [, forceRerender] = useState(0);

  useEffect(() => {
    if (asset.missing || printResolutionCache.has(cacheKey)) {
      return;
    }

    let cancelled = false;
    void getEppApi()
      .images.decodeAtSize(asset.storedPath, minWidthPx, minHeightPx)
      .then((dataUrl) => {
        printResolutionCache.set(cacheKey, dataUrl);
        if (!cancelled) {
          forceRerender((count) => count + 1);
        }
      })
      .catch(() => {
        // Leave the caller falling back to the thumbnail -- a failed high-res decode (e.g. the
        // file went missing mid-session) shouldn't break preview, just leave it less sharp.
      });

    return () => {
      cancelled = true;
    };
  }, [asset.missing, asset.storedPath, cacheKey, minWidthPx, minHeightPx]);

  return printResolutionCache.get(cacheKey);
}
