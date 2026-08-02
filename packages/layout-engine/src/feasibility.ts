// @spec OPENSPEC.md §4.1.2 — validateLayoutFeasibility
import { computeMinRequiredMainSizeMm } from './flexDistribution.js';
import type { BoxMm, FeasibilityWarning, LayoutNode } from './types.js';

export function validateLayoutFeasibility(
  node: LayoutNode,
  assignedBox: BoxMm,
  resultMap: Map<string, BoxMm>,
): FeasibilityWarning[] {
  const warnings: FeasibilityWarning[] = [];
  const minWidth = computeMinRequiredMainSizeMm(node, 'w');
  const minHeight = computeMinRequiredMainSizeMm(node, 'h');

  if (minWidth > assignedBox.w) {
    warnings.push({
      nodeId: node.id,
      axis: 'w',
      requiredMm: minWidth,
      availableMm: assignedBox.w,
    });
  }

  if (minHeight > assignedBox.h) {
    warnings.push({
      nodeId: node.id,
      axis: 'h',
      requiredMm: minHeight,
      availableMm: assignedBox.h,
    });
  }

  for (const child of node.children ?? []) {
    const childBox = resultMap.get(child.id);
    if (childBox) {
      warnings.push(...validateLayoutFeasibility(child, childBox, resultMap));
    }
  }

  return warnings;
}

