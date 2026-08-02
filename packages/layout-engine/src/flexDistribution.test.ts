import { describe, expect, it } from 'vitest';

import {
  computeMinRequiredMainSizeMm,
  distributeChildren,
  isDividerLocked,
  resizeSiblingsByDrag,
} from './flexDistribution.js';
import type { LayoutNode } from './types.js';

describe('flex distribution', () => {
  it('distributes fixed and flexible children on the main axis', () => {
    const children: LayoutNode[] = [
      { id: 'fixed', type: 'imageSlot', fixedSizeMm: { widthMm: 50 } },
      { id: 'flex', type: 'imageSlot', sizeRatio: 1 },
    ];

    expect(
      distributeChildren(
        { x: 0, y: 0, w: 200, h: 100 },
        children,
        10,
        'horizontal',
        { vertical: 'expand' },
        { top: 10, right: 10, bottom: 10, left: 10 },
      ),
    ).toEqual([
      { x: 10, y: 10, w: 50, h: 80 },
      { x: 70, y: 10, w: 120, h: 80 },
    ]);
  });

  it('locks dividers next to fixed siblings', () => {
    const children: LayoutNode[] = [
      { id: 'a', type: 'imageSlot', fixedSizeMm: { widthMm: 30 } },
      { id: 'b', type: 'imageSlot' },
    ];

    expect(isDividerLocked(children, 0, 'widthMm')).toBe(true);
  });

  it('resizes only the adjacent flexible siblings', () => {
    const children: LayoutNode[] = [
      { id: 'a', type: 'imageSlot', sizeRatio: 1 },
      { id: 'b', type: 'imageSlot', sizeRatio: 1 },
      { id: 'c', type: 'imageSlot', sizeRatio: 1 },
    ];

    const resized = resizeSiblingsByDrag(children, 0, 20, 180, 'widthMm', 'w');
    expect(resized[0].sizeRatio).toBeCloseTo(1.3333333333);
    expect(resized[1].sizeRatio).toBeCloseTo(0.6666666667);
    expect(resized[2].sizeRatio).toBe(1);
  });

  it('computes grid minimum size bottom-up on both axes', () => {
    const node: LayoutNode = {
      id: 'grid',
      type: 'grid',
      gapMm: 3,
      gridConfig: { rows: 1, columns: 2 },
      children: [
        { id: 'left', type: 'imageSlot', fixedSizeMm: { widthMm: 40, heightMm: 20 } },
        { id: 'right', type: 'imageSlot', fixedSizeMm: { widthMm: 30, heightMm: 25 } },
      ],
    };

    expect(computeMinRequiredMainSizeMm(node, 'w')).toBe(73);
    expect(computeMinRequiredMainSizeMm(node, 'h')).toBe(25);
  });
});

