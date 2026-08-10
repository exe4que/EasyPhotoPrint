import type { BoxMm, SheetSize } from '@epp/layout-engine';

const PAGE_PRESETS_MM = {
  A4: { widthMm: 210, heightMm: 297 },
  Letter: { widthMm: 215.9, heightMm: 279.4 },
  Legal: { widthMm: 215.9, heightMm: 355.6 },
  '4x6': { widthMm: 101.6, heightMm: 152.4 },
  '5x7': { widthMm: 127, heightMm: 177.8 },
  A3: { widthMm: 297, heightMm: 420 },
} as const;

export function resolvePageSizeMm(
  sheetSize: SheetSize,
  orientation: 'portrait' | 'landscape',
): { widthMm: number; heightMm: number } {
  const baseSize =
    sheetSize.sizePreset === 'Custom'
      ? sheetSize.customSizeMm ?? { widthMm: 210, heightMm: 297 }
      : PAGE_PRESETS_MM[sheetSize.sizePreset];

  if (orientation === 'landscape') {
    return {
      widthMm: baseSize.heightMm,
      heightMm: baseSize.widthMm,
    };
  }

  return baseSize;
}

export function createPageBoxMm(sheetSize: SheetSize, orientation: 'portrait' | 'landscape'): BoxMm {
  const size = resolvePageSizeMm(sheetSize, orientation);
  return {
    x: 0,
    y: 0,
    w: size.widthMm,
    h: size.heightMm,
  };
}

