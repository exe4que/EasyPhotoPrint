import type { LayoutNode } from './types.js';

/**
 * A tree is compatible with Simple mode when it has at most two levels — the
 * root node, and (if the root is a container) its direct children — and every
 * node at the lowest level is an `imageSlot`. Anything deeper (a nested
 * container as a child, or a grandchild of any kind) disqualifies it.
 */
export function isSimpleModeCompatible(rootNode: LayoutNode): boolean {
  if (rootNode.type === 'imageSlot') {
    return true;
  }

  const children = rootNode.children ?? [];
  return children.every((child) => child.type === 'imageSlot' && (child.children?.length ?? 0) === 0);
}
