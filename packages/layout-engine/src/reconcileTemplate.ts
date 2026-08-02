// @spec OPENSPEC.md §3.3 — reconcileTemplateUpdate
import type { LayoutNode, TemplateReconciliationResult } from './types.js';

function cloneLayoutNode(node: LayoutNode): LayoutNode {
  return {
    ...node,
    fixedSizeMm: node.fixedSizeMm ? { ...node.fixedSizeMm } : undefined,
    alignment: node.alignment ? { ...node.alignment } : undefined,
    paddingMm: node.paddingMm ? { ...node.paddingMm } : undefined,
    gridConfig: node.gridConfig ? { ...node.gridConfig } : undefined,
    imageSlotConfig: node.imageSlotConfig
      ? {
          ...node.imageSlotConfig,
          focalPoint: node.imageSlotConfig.focalPoint ? { ...node.imageSlotConfig.focalPoint } : undefined,
        }
      : undefined,
    freeformElements: node.freeformElements?.map((element) => ({
      ...element,
      transform: { ...element.transform },
    })),
    children: node.children?.map(cloneLayoutNode),
  };
}

function collectImageSlotIds(node: LayoutNode, into: Set<string>): void {
  if (node.type === 'imageSlot') {
    into.add(node.id);
  }

  for (const child of node.children ?? []) {
    collectImageSlotIds(child, into);
  }
}

export function reconcileTemplateUpdate(
  oldRootNode: LayoutNode,
  newRootNode: LayoutNode,
  assignments: Record<string, string>,
): TemplateReconciliationResult {
  const oldSlotIds = new Set<string>();
  const newSlotIds = new Set<string>();
  collectImageSlotIds(oldRootNode, oldSlotIds);
  collectImageSlotIds(newRootNode, newSlotIds);

  const preservedSlotIds = [...oldSlotIds].filter((slotId) => newSlotIds.has(slotId));
  const addedSlotIds = [...newSlotIds].filter((slotId) => !oldSlotIds.has(slotId));
  const removedSlotIds = [...oldSlotIds].filter((slotId) => !newSlotIds.has(slotId));

  const nextAssignments: Record<string, string> = {};
  for (const slotId of preservedSlotIds) {
    const imageAssetId = assignments[slotId];
    if (imageAssetId != null) {
      nextAssignments[slotId] = imageAssetId;
    }
  }

  const removedAssignments: Record<string, string> = {};
  for (const slotId of removedSlotIds) {
    const imageAssetId = assignments[slotId];
    if (imageAssetId != null) {
      removedAssignments[slotId] = imageAssetId;
    }
  }

  return {
    rootNode: cloneLayoutNode(newRootNode),
    assignments: nextAssignments,
    removedAssignments,
    preservedSlotIds,
    addedSlotIds,
  };
}

