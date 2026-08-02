// @spec OPENSPEC.md §2.3, §3.3, §5.2 — page size resolution from per-page PageConfig
import type { BoxMm, PageConfig } from '@epp/layout-engine';

const PAGE_PRESETS_MM = {
  A4: { widthMm: 210, heightMm: 297 },
  Letter: { widthMm: 215.9, heightMm: 279.4 },
  Legal: { widthMm: 215.9, heightMm: 355.6 },
  '4x6': { widthMm: 101.6, heightMm: 152.4 },
  '5x7': { widthMm: 127, heightMm: 177.8 },
  A3: { widthMm: 297, heightMm: 420 },
} as const;

export function resolvePageSizeMm(pageConfig: PageConfig): { widthMm: number; heightMm: number } {
  const baseSize =
    pageConfig.sizePreset === 'Custom'
      ? pageConfig.customSizeMm ?? { widthMm: 210, heightMm: 297 }
      : PAGE_PRESETS_MM[pageConfig.sizePreset];

  if (pageConfig.orientation === 'landscape') {
    return {
      widthMm: baseSize.heightMm,
      heightMm: baseSize.widthMm,
    };
  }

  return baseSize;
}

export function createPageBoxMm(pageConfig: PageConfig): BoxMm {
  const size = resolvePageSizeMm(pageConfig);
  return {
    x: 0,
    y: 0,
    w: size.widthMm,
    h: size.heightMm,
  };
}

