import { describe, expect, it } from 'vitest';

import { computeGridCells, resolveDimensions } from './grid.js';

describe('grid helpers', () => {
  it('resolves autofit dimensions from the available aspect ratio', () => {
    expect(resolveDimensions({ autoFit: true }, 6, 2)).toEqual({ rows: 2, columns: 4 });
  });

  it('computes grid cells with padding and per-axis gaps', () => {
    const cells = computeGridCells(
      { x: 0, y: 0, w: 100, h: 70 },
      { rows: 2, columns: 2, rowGapMm: 4, columnGapMm: 2 },
      4,
      0,
      { top: 10, right: 5, bottom: 5, left: 5 },
    );

    expect(cells).toHaveLength(4);
    expect(cells[0]).toEqual({ x: 5, y: 10, w: 44, h: 25.5 });
    expect(cells[3]).toEqual({ x: 51, y: 39.5, w: 44, h: 25.5 });
  });
});

