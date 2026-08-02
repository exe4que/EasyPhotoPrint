// @spec OPENSPEC.md §4.1, §4.2 — resolveLayout and freeform element box resolution
import { applyPadding, distributeChildren } from './flexDistribution.js';
import { computeGridCells } from './grid.js';
import type { BoxMm, LayoutNode } from './types.js';

function recordFreeformElements(node: LayoutNode, containerBox: BoxMm, resultMap: Map<string, BoxMm>): void {
  for (const element of node.freeformElements ?? []) {
    resultMap.set(element.id, {
      x: containerBox.x + element.transform.xMm,
      y: containerBox.y + element.transform.yMm,
      w: element.transform.widthMm,
      h: element.transform.heightMm,
    });
  }
}

function resolveNode(node: LayoutNode, availableBox: BoxMm, resultMap: Map<string, BoxMm>): void {
  if (node.type === 'imageSlot') {
    resultMap.set(node.id, applyPadding(availableBox, node.paddingMm));
    return;
  }

  resultMap.set(node.id, availableBox);

  if (node.type === 'freeformCanvas') {
    recordFreeformElements(node, availableBox, resultMap);
    return;
  }

  const children = node.children ?? [];
  if (children.length === 0) {
    return;
  }

  if (node.type === 'grid') {
    const cells = computeGridCells(
      availableBox,
      node.gridConfig,
      children.length,
      node.gapMm ?? 0,
      node.paddingMm,
    );

    children.forEach((child, index) => {
      const cell = cells[index];
      if (cell) {
        resolveNode(child, cell, resultMap);
      }
    });
    return;
  }

  const childBoxes = distributeChildren(
    availableBox,
    children,
    node.gapMm ?? 0,
    node.type,
    node.alignment,
    node.paddingMm,
  );

  children.forEach((child, index) => {
    const childBox = childBoxes[index];
    if (childBox) {
      resolveNode(child, childBox, resultMap);
    }
  });
}

export function resolveLayout(rootNode: LayoutNode, availableBox: BoxMm): Map<string, BoxMm> {
  const resultMap = new Map<string, BoxMm>();
  resolveNode(rootNode, availableBox, resultMap);
  return resultMap;
}
