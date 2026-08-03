import { describe, expect, it } from 'vitest';

import { isSimpleModeCompatible } from './simpleMode.js';
import type { LayoutNode } from './types.js';

function imageSlot(id: string): LayoutNode {
  return { id, type: 'imageSlot' };
}

describe('isSimpleModeCompatible', () => {
  it('accepts a lone imageSlot root', () => {
    expect(isSimpleModeCompatible(imageSlot('root'))).toBe(true);
  });

  it('accepts a container root whose direct children are all imageSlots', () => {
    const root: LayoutNode = {
      id: 'root',
      type: 'grid',
      children: [imageSlot('slot-1'), imageSlot('slot-2')],
    };
    expect(isSimpleModeCompatible(root)).toBe(true);
  });

  it('accepts a container root with no children', () => {
    const root: LayoutNode = { id: 'root', type: 'freeformCanvas', children: [] };
    expect(isSimpleModeCompatible(root)).toBe(true);
  });

  it('rejects a container root with a nested container child', () => {
    const root: LayoutNode = {
      id: 'root',
      type: 'horizontal',
      children: [imageSlot('slot-1'), { id: 'nested', type: 'vertical', children: [imageSlot('slot-2')] }],
    };
    expect(isSimpleModeCompatible(root)).toBe(false);
  });

  it('rejects a tree with three levels even when leaves are imageSlots', () => {
    const root: LayoutNode = {
      id: 'root',
      type: 'vertical',
      children: [
        {
          id: 'mid',
          type: 'horizontal',
          children: [imageSlot('slot-1'), imageSlot('slot-2')],
        },
      ],
    };
    expect(isSimpleModeCompatible(root)).toBe(false);
  });
});
