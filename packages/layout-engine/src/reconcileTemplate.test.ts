import { describe, expect, it } from 'vitest';

import { reconcileTemplateUpdate } from './reconcileTemplate.js';
import type { LayoutNode } from './types.js';

describe('reconcileTemplateUpdate', () => {
  it('preserves matching slot assignments and returns removed ones', () => {
    const oldRoot: LayoutNode = {
      id: 'root',
      type: 'vertical',
      children: [
        { id: 'slot-a', type: 'imageSlot' },
        { id: 'slot-b', type: 'imageSlot' },
      ],
    };
    const newRoot: LayoutNode = {
      id: 'root',
      type: 'vertical',
      children: [
        { id: 'slot-b', type: 'imageSlot' },
        { id: 'slot-c', type: 'imageSlot' },
      ],
    };

    expect(
      reconcileTemplateUpdate(oldRoot, newRoot, {
        'slot-a': 'image-1',
        'slot-b': 'image-2',
      }),
    ).toEqual({
      rootNode: newRoot,
      assignments: { 'slot-b': 'image-2' },
      removedAssignments: { 'slot-a': 'image-1' },
      preservedSlotIds: ['slot-b'],
      addedSlotIds: ['slot-c'],
    });
  });
});

