import { describe, expect, it } from 'vitest';

import { validateLayoutFeasibility } from './feasibility.js';
import { resolveLayout } from './resolveLayout.js';
import type { LayoutNode } from './types.js';

describe('validateLayoutFeasibility', () => {
  it('reports infeasible containers when descendants require more size than available', () => {
    const root: LayoutNode = {
      id: 'root',
      type: 'horizontal',
      gapMm: 10,
      children: [
        { id: 'left', type: 'imageSlot', fixedSizeMm: { widthMm: 80, heightMm: 20 } },
        { id: 'right', type: 'imageSlot', fixedSizeMm: { widthMm: 40, heightMm: 20 } },
      ],
    };

    const resultMap = resolveLayout(root, { x: 0, y: 0, w: 100, h: 40 });
    expect(validateLayoutFeasibility(root, { x: 0, y: 0, w: 100, h: 40 }, resultMap)).toContainEqual({
      nodeId: 'root',
      axis: 'w',
      requiredMm: 130,
      availableMm: 100,
    });
  });
});

