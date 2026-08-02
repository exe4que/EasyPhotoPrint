import { describe, expect, it } from 'vitest';

import { createPageBoxMm, resolvePageSizeMm } from './page.js';

describe('page sizing', () => {
  it('resolves preset page sizes in portrait', () => {
    expect(resolvePageSizeMm({ sizePreset: 'A4', orientation: 'portrait', dpi: 300 })).toEqual({
      widthMm: 210,
      heightMm: 297,
    });
  });

  it('swaps dimensions in landscape', () => {
    expect(resolvePageSizeMm({ sizePreset: 'A4', orientation: 'landscape', dpi: 300 })).toEqual({
      widthMm: 297,
      heightMm: 210,
    });
  });

  it('creates a canonical page box from page config', () => {
    expect(
      createPageBoxMm({
        sizePreset: 'Custom',
        customSizeMm: { widthMm: 100, heightMm: 200 },
        orientation: 'portrait',
        dpi: 300,
      }),
    ).toEqual({ x: 0, y: 0, w: 100, h: 200 });
  });
});
