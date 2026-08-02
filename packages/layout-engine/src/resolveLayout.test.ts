import { describe, expect, it } from 'vitest';

import { resolveLayout } from './resolveLayout.js';
import type { LayoutNode } from './types.js';

describe('resolveLayout', () => {
  it('resolves nested horizontal layouts and freeform elements', () => {
    const root: LayoutNode = {
      id: 'root',
      type: 'horizontal',
      gapMm: 10,
      paddingMm: { top: 10, right: 10, bottom: 10, left: 10 },
      children: [
        { id: 'slot-a', type: 'imageSlot', fixedSizeMm: { widthMm: 50 } },
        {
          id: 'freeform',
          type: 'freeformCanvas',
          freeformElements: [
            {
              id: 'element-1',
              imageNodeId: 'slot-b',
              transform: { xMm: 5, yMm: 10, widthMm: 20, heightMm: 30, rotationDeg: 0 },
            },
          ],
        },
      ],
    };

    const result = resolveLayout(root, { x: 0, y: 0, w: 200, h: 100 });
    expect(result.get('root')).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    expect(result.get('slot-a')).toEqual({ x: 10, y: 10, w: 50, h: 80 });
    expect(result.get('freeform')).toEqual({ x: 70, y: 10, w: 120, h: 80 });
    expect(result.get('element-1')).toEqual({ x: 75, y: 20, w: 20, h: 30 });
  });

  it('applies padding to an image slot box itself', () => {
    const root: LayoutNode = {
      id: 'root',
      type: 'imageSlot',
      paddingMm: { top: 5, right: 10, bottom: 15, left: 20 },
    };

    const result = resolveLayout(root, { x: 0, y: 0, w: 200, h: 100 });
    expect(result.get('root')).toEqual({ x: 20, y: 5, w: 170, h: 80 });
  });
});
