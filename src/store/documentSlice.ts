import {
  applyPadding,
  clampFreeformPosition,
  cloneLayoutNode,
  computeMinRequiredMainSizeMm,
  MIN_FREEFORM_SIZE_MM,
  reconcileTemplateUpdate,
  resolveLayout,
  resizeSiblingsByDrag as resizeAdjacentSiblings,
  type EPPProjectPage,
  type EPPTemplate,
  type FreeformElement,
  type FreeformTransform,
  type GridConfig,
  type ImageAsset,
  type ImageRotationDeg,
  type LayoutNode,
  type ProjectPageConfig,
  type ScalingRule,
  type SheetSize,
  type Sides,
  type SpecificSizeMm,
} from '@epp/layout-engine';

import { createPageBoxMm } from '../lib/page.js';

const DEFAULT_SHEET_SIZE: SheetSize = {
  sizePreset: 'A4',
};

const DEFAULT_PAGE_CONFIG: ProjectPageConfig = {
  orientation: 'portrait',
  dpi: 300,
};

function createImageSlot(id: string): LayoutNode {
  return {
    id,
    type: 'imageSlot',
    imageSlotConfig: {
      scalingRule: 'fitInParent',
    },
  };
}

type NestedNodeType = LayoutNode['type'];
const SIMPLE_ROOT_ID = 'root-grid';

function parseSlotSequence(id: string): number | null {
  const match = /^slot-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

function createNextImageSlotId(children: LayoutNode[]): string {
  const maxId = children.reduce((currentMax, child) => {
    const parsed = parseSlotSequence(child.id);
    return parsed == null ? currentMax : Math.max(currentMax, parsed);
  }, 0);

  return `slot-${maxId + 1}`;
}

function collectAllNodeIds(node: LayoutNode, ids: Set<string>): void {
  ids.add(node.id);
  for (const child of node.children ?? []) {
    collectAllNodeIds(child, ids);
  }
}

/** Scans every node id in the tree, not just current imageSlot ids -- a node that used to be
 * "slot-N" keeps that id when retyped to another type (e.g. freeformCanvas), so checking only
 * imageSlot ids would let this generator reissue "slot-N" for a brand-new shadow slot, colliding
 * with the retyped node's own id. */
function createSlotIdGenerator(rootNode: LayoutNode): () => string {
  const nodeIds = new Set<string>();
  collectAllNodeIds(rootNode, nodeIds);
  let currentMax = [...nodeIds].reduce((max, id) => {
    const parsed = parseSlotSequence(id);
    return parsed == null ? max : Math.max(max, parsed);
  }, 0);

  return () => {
    currentMax += 1;
    return `slot-${currentMax}`;
  };
}

function mergePadding(
  currentPadding: Partial<Sides> | undefined,
  patchPadding: Partial<Sides> | undefined,
): Partial<Sides> | undefined {
  return patchPadding ? { ...currentPadding, ...patchPadding } : currentPadding;
}

function collectImageSlotIds(node: LayoutNode, slotIds: Set<string>): void {
  if (node.type === 'imageSlot') {
    slotIds.add(node.id);
  }

  for (const child of node.children ?? []) {
    collectImageSlotIds(child, slotIds);
  }
}

function filterAssignmentsForRootNode(rootNode: LayoutNode, assignments: Record<string, string>): Record<string, string> {
  const slotIds = new Set<string>();
  collectImageSlotIds(rootNode, slotIds);
  return Object.fromEntries(Object.entries(assignments).filter(([slotId]) => slotIds.has(slotId)));
}

export function reconcileGridChildren(children: LayoutNode[], targetCount: number): LayoutNode[] {
  if (targetCount <= children.length) {
    return children.slice(0, targetCount).map(cloneLayoutNode);
  }

  const nextChildren = children.map(cloneLayoutNode);
  for (let index = children.length; index < targetCount; index += 1) {
    nextChildren.push(createImageSlot(createNextImageSlotId(nextChildren)));
  }

  return nextChildren;
}

function normalizeGridConfig(gridConfig: Partial<GridConfig> | undefined): GridConfig {
  return {
    rows: Math.max(1, gridConfig?.rows ?? 1),
    columns: Math.max(1, gridConfig?.columns ?? 1),
    autoFit: gridConfig?.autoFit ?? false,
    rowGapMm: gridConfig?.rowGapMm,
    columnGapMm: gridConfig?.columnGapMm,
  };
}

function createDefaultChildren(nextSlotId: () => string): LayoutNode[] {
  return [createImageSlot(nextSlotId()), createImageSlot(nextSlotId())];
}

function cloneAsSimpleImageSlot(node: LayoutNode): LayoutNode {
  return {
    ...createImageSlot(node.id),
    fixedSizeMm: node.fixedSizeMm,
    alignment: node.alignment,
    imageSlotConfig: node.imageSlotConfig ? { ...node.imageSlotConfig } : { scalingRule: 'fitInParent' },
  };
}

function collectImageSlotNodes(node: LayoutNode, nodes: LayoutNode[] = [], includeRoot = true): LayoutNode[] {
  if (node.type === 'imageSlot' && includeRoot) {
    nodes.push(node);
  }
  for (const child of node.children ?? []) {
    collectImageSlotNodes(child, nodes, true);
  }
  return nodes;
}

function buildSimpleChildren(rootNode: LayoutNode, nextSlotId: () => string): LayoutNode[] {
  const flattenedSlots = collectImageSlotNodes(rootNode, [], false).map(cloneAsSimpleImageSlot);
  return flattenedSlots.length > 0 ? flattenedSlots : createDefaultChildren(nextSlotId);
}

function normalizeRootForSimpleMode(rootNode: LayoutNode, nextSlotId: () => string): LayoutNode {
  if (rootNode.type === 'imageSlot') {
    return {
      ...createImageSlot(rootNode.id),
      paddingMm: rootNode.paddingMm ?? { top: 5, right: 5, bottom: 5, left: 5 },
      fixedSizeMm: rootNode.fixedSizeMm,
      alignment: rootNode.alignment,
      imageSlotConfig: rootNode.imageSlotConfig ? { ...rootNode.imageSlotConfig } : { scalingRule: 'fitInParent' },
    };
  }

  const directSlots = buildSimpleChildren(rootNode, nextSlotId);
  if (rootNode.type === 'grid') {
    const nextGridConfig = normalizeGridConfig(
      rootNode.gridConfig ?? {
        rows: 1,
        columns: 2,
        autoFit: false,
      },
    );
    const targetCount = Math.max(1, nextGridConfig.rows * nextGridConfig.columns);
    return {
      ...rootNode,
      type: 'grid',
      paddingMm: rootNode.paddingMm ?? { top: 5, right: 5, bottom: 5, left: 5 },
      gapMm: rootNode.gapMm ?? 3,
      gridConfig: nextGridConfig,
      children: reconcileGridChildren(directSlots, targetCount),
      freeformElements: undefined,
      imageSlotConfig: undefined,
    };
  }

  if (rootNode.type === 'horizontal' || rootNode.type === 'vertical') {
    return {
      ...rootNode,
      type: rootNode.type,
      paddingMm: rootNode.paddingMm ?? { top: 5, right: 5, bottom: 5, left: 5 },
      gapMm: rootNode.gapMm ?? 3,
      children: directSlots,
      gridConfig: undefined,
      freeformElements: undefined,
      imageSlotConfig: undefined,
    };
  }

  if (rootNode.type === 'freeformCanvas') {
    return {
      ...rootNode,
      paddingMm: rootNode.paddingMm ?? { top: 5, right: 5, bottom: 5, left: 5 },
      freeformElements: rootNode.freeformElements ?? [],
      children: undefined,
      gridConfig: undefined,
      imageSlotConfig: undefined,
    };
  }

  return {
    ...createImageSlot(rootNode.id),
    paddingMm: { top: 5, right: 5, bottom: 5, left: 5 },
  };
}

function createNodeForType(type: NestedNodeType, nextSlotId: () => string, existingId?: string): LayoutNode {
  switch (type) {
    case 'imageSlot':
      return createImageSlot(existingId ?? nextSlotId());
    case 'grid':
      return {
        id: existingId ?? crypto.randomUUID(),
        type: 'grid',
        gapMm: 3,
        paddingMm: { top: 0, right: 0, bottom: 0, left: 0 },
        gridConfig: {
          rows: 1,
          columns: 2,
          autoFit: false,
        },
        children: createDefaultChildren(nextSlotId),
      };
    case 'horizontal':
    case 'vertical':
      return {
        id: existingId ?? crypto.randomUUID(),
        type,
        gapMm: 3,
        paddingMm: { top: 0, right: 0, bottom: 0, left: 0 },
        children: createDefaultChildren(nextSlotId),
      };
    case 'freeformCanvas':
      return {
        id: existingId ?? crypto.randomUUID(),
        type: 'freeformCanvas',
        freeformElements: [],
      };
    default:
      return createImageSlot(existingId ?? nextSlotId());
  }
}

function createDefaultRootNode(): LayoutNode {
  return {
    id: SIMPLE_ROOT_ID,
    type: 'imageSlot',
    paddingMm: { top: 5, right: 5, bottom: 5, left: 5 },
    imageSlotConfig: {
      scalingRule: 'fitInParent',
    },
  };
}

export function createDefaultPage(id: string = crypto.randomUUID()): EPPProjectPage {
  return {
    id,
    pageConfig: { ...DEFAULT_PAGE_CONFIG },
    templateRef: undefined,
    rootNode: createDefaultRootNode(),
    assignments: {},
  };
}

function updateNodeById(node: LayoutNode, nodeId: string, patch: Partial<LayoutNode>): LayoutNode {
  if (node.id === nodeId) {
    return {
      ...node,
      ...patch,
      fixedSizeMm: patch.fixedSizeMm ? { ...node.fixedSizeMm, ...patch.fixedSizeMm } : node.fixedSizeMm,
      alignment: patch.alignment ? { ...node.alignment, ...patch.alignment } : node.alignment,
      paddingMm: mergePadding(node.paddingMm, patch.paddingMm),
      gridConfig: patch.gridConfig ? { ...node.gridConfig, ...patch.gridConfig } : node.gridConfig,
      imageSlotConfig: patch.imageSlotConfig
        ? {
            ...node.imageSlotConfig,
            ...patch.imageSlotConfig,
            focalPoint: patch.imageSlotConfig.focalPoint
              ? { ...node.imageSlotConfig?.focalPoint, ...patch.imageSlotConfig.focalPoint }
              : node.imageSlotConfig?.focalPoint,
          }
        : node.imageSlotConfig,
      freeformElements: patch.freeformElements ? [...patch.freeformElements] : node.freeformElements,
      children: patch.children ? patch.children.map(cloneLayoutNode) : node.children,
    };
  }

  if (!node.children?.length) {
    return node;
  }

  return {
    ...node,
    children: node.children.map((child) => updateNodeById(child, nodeId, patch)),
  };
}

export function findNodeById(node: LayoutNode, nodeId: string): LayoutNode | undefined {
  if (node.id === nodeId) {
    return node;
  }

  for (const child of node.children ?? []) {
    const match = findNodeById(child, nodeId);
    if (match) {
      return match;
    }
  }

  return undefined;
}

function updateChildrenForNode(node: LayoutNode, nodeId: string, transform: (children: LayoutNode[]) => LayoutNode[]): LayoutNode {
  if (node.id === nodeId) {
    return {
      ...node,
      children: transform(node.children ?? []).map(cloneLayoutNode),
    };
  }

  return {
    ...node,
    children: node.children?.map((child) => updateChildrenForNode(child, nodeId, transform)),
  };
}

function retypeNodeById(
  node: LayoutNode,
  nodeId: string,
  nextType: NestedNodeType,
  nextSlotId: () => string,
): LayoutNode {
  if (node.id === nodeId) {
    if (node.type === nextType) {
      return node;
    }

    if (nextType === 'imageSlot') {
      return {
        ...createNodeForType(nextType, nextSlotId, node.id),
        fixedSizeMm: node.fixedSizeMm,
        alignment: node.alignment,
      };
    }

    if (nextType === 'grid') {
      const children = node.type === 'imageSlot' ? createDefaultChildren(nextSlotId) : node.children ?? createDefaultChildren(nextSlotId);
      return {
        ...node,
        type: 'grid',
        gapMm: node.gapMm ?? 3,
        paddingMm: node.paddingMm ?? { top: 0, right: 0, bottom: 0, left: 0 },
        gridConfig: {
          rows: 1,
          columns: Math.max(children.length, 1),
          autoFit: false,
        },
        children,
        imageSlotConfig: undefined,
        freeformElements: undefined,
      };
    }

    if (nextType === 'horizontal' || nextType === 'vertical') {
      return {
        ...node,
        type: nextType,
        gapMm: node.gapMm ?? 3,
        paddingMm: node.paddingMm ?? { top: 0, right: 0, bottom: 0, left: 0 },
        children: node.type === 'imageSlot' ? createDefaultChildren(nextSlotId) : node.children ?? createDefaultChildren(nextSlotId),
        gridConfig: undefined,
        imageSlotConfig: undefined,
        freeformElements: undefined,
      };
    }

    return {
      ...node,
      type: 'freeformCanvas',
      children: undefined,
      gridConfig: undefined,
      imageSlotConfig: undefined,
      freeformElements: node.freeformElements ?? [],
    };
  }

  return {
    ...node,
    children: node.children?.map((child) => retypeNodeById(child, nodeId, nextType, nextSlotId)),
  };
}

function addChildNodeById(
  node: LayoutNode,
  parentNodeId: string,
  childType: NestedNodeType,
  nextSlotId: () => string,
): LayoutNode {
  if (node.id === parentNodeId) {
    if (node.type !== 'horizontal' && node.type !== 'vertical') {
      throw new Error(`Node ${parentNodeId} does not support add-child in nested mode.`);
    }

    return {
      ...node,
      children: [...(node.children ?? []), createNodeForType(childType, nextSlotId)],
    };
  }

  return {
    ...node,
    children: node.children?.map((child) => addChildNodeById(child, parentNodeId, childType, nextSlotId)),
  };
}

function removeNodeById(node: LayoutNode, nodeId: string): LayoutNode {
  return {
    ...node,
    children: node.children
      ?.filter((child) => child.id !== nodeId)
      .map((child) => removeNodeById(child, nodeId)),
  };
}

function updateGridNodeById(
  node: LayoutNode,
  nodeId: string,
  patch: {
    gridConfig?: Partial<GridConfig>;
    gapMm?: number;
    paddingMm?: Partial<Sides>;
  },
): LayoutNode {
  if (node.id === nodeId) {
    if (node.type !== 'grid') {
      throw new Error(`Node ${nodeId} is not a grid node.`);
    }

    const nextGridConfig = normalizeGridConfig({
      ...node.gridConfig,
      ...patch.gridConfig,
    });
    const nextChildCount = nextGridConfig.rows * nextGridConfig.columns;

    return {
      ...node,
      gapMm: patch.gapMm ?? node.gapMm,
      paddingMm: mergePadding(node.paddingMm, patch.paddingMm),
      gridConfig: nextGridConfig,
      children: reconcileGridChildren(node.children ?? [], nextChildCount),
    };
  }

  return {
    ...node,
    children: node.children?.map((child) => updateGridNodeById(child, nodeId, patch)),
  };
}

function updateContainerChildCountById(node: LayoutNode, nodeId: string, count: number): LayoutNode {
  if (node.id === nodeId) {
    if (node.type !== 'horizontal' && node.type !== 'vertical') {
      throw new Error(`Node ${nodeId} does not support setting a child count (only horizontal/vertical do).`);
    }

    return {
      ...node,
      children: reconcileGridChildren(node.children ?? [], Math.max(1, count)),
    };
  }

  return {
    ...node,
    children: node.children?.map((child) => updateContainerChildCountById(child, nodeId, count)),
  };
}

function addFreeformElementToNode(
  node: LayoutNode,
  freeformCanvasNodeId: string,
  imageSlot: LayoutNode,
  element: FreeformElement,
): LayoutNode {
  if (node.id === freeformCanvasNodeId) {
    if (node.type !== 'freeformCanvas') {
      throw new Error(`Node ${freeformCanvasNodeId} is not a freeformCanvas node.`);
    }

    return {
      ...node,
      children: [...(node.children ?? []), imageSlot],
      freeformElements: [...(node.freeformElements ?? []), element],
    };
  }

  return {
    ...node,
    children: node.children?.map((child) => addFreeformElementToNode(child, freeformCanvasNodeId, imageSlot, element)),
  };
}

function removeFreeformElementEntryById(node: LayoutNode, freeformCanvasNodeId: string, freeformElementId: string): LayoutNode {
  if (node.id === freeformCanvasNodeId) {
    return {
      ...node,
      freeformElements: node.freeformElements?.filter((element) => element.id !== freeformElementId),
    };
  }

  return {
    ...node,
    children: node.children?.map((child) => removeFreeformElementEntryById(child, freeformCanvasNodeId, freeformElementId)),
  };
}

function setFreeformElementTransformById(
  node: LayoutNode,
  freeformCanvasNodeId: string,
  freeformElementId: string,
  transform: FreeformTransform,
): LayoutNode {
  if (node.id === freeformCanvasNodeId) {
    return {
      ...node,
      freeformElements: node.freeformElements?.map((element) =>
        element.id === freeformElementId ? { ...element, transform } : element,
      ),
    };
  }

  return {
    ...node,
    children: node.children?.map((child) => setFreeformElementTransformById(child, freeformCanvasNodeId, freeformElementId, transform)),
  };
}

export function assignImageToPage(page: EPPProjectPage, nodeId: string, imageAssetId: string): Record<string, string> {
  return { ...page.assignments, [nodeId]: imageAssetId };
}

export function clearImageFromPage(page: EPPProjectPage, nodeId: string): Record<string, string> {
  const nextAssignments = { ...page.assignments };
  delete nextAssignments[nodeId];
  return nextAssignments;
}

function createTemplateFromPage(sheetSize: SheetSize, page: EPPProjectPage): EPPTemplate {
  return {
    schemaVersion: '1.0.0',
    id: crypto.randomUUID(),
    name: `Template ${page.id}`,
    page: {
      sizePreset: sheetSize.sizePreset,
      customSizeMm: sheetSize.customSizeMm,
      orientation: page.pageConfig.orientation,
      dpi: page.pageConfig.dpi,
    },
    rootNode: cloneLayoutNode(page.rootNode),
  };
}

function computeAvailableMainSize(sheetSize: SheetSize, page: EPPProjectPage, parentNode: LayoutNode): {
  availableMain: number;
  mainAxisKey: 'widthMm' | 'heightMm';
  axis: 'w' | 'h';
} {
  if (parentNode.type !== 'horizontal' && parentNode.type !== 'vertical') {
    throw new Error(`resizeSiblingsByDrag only supports horizontal or vertical parent nodes. Received ${parentNode.type}.`);
  }

  const pageBox = createPageBoxMm(sheetSize, page.pageConfig.orientation);
  const layout = resolveLayout(page.rootNode, pageBox);
  const parentBox = layout.get(parentNode.id);
  if (!parentBox) {
    throw new Error(`Could not resolve layout for parent node ${parentNode.id}.`);
  }

  const paddedBox = applyPadding(parentBox, parentNode.paddingMm);
  const children = parentNode.children ?? [];
  const gapTotal = (parentNode.gapMm ?? 0) * Math.max(children.length - 1, 0);
  if (parentNode.type === 'horizontal') {
    const fixedTotal = children.reduce((sum, child) => sum + (child.fixedSizeMm?.widthMm ?? 0), 0);
    return {
      availableMain: Math.max(0, paddedBox.w - gapTotal - fixedTotal),
      mainAxisKey: 'widthMm',
      axis: 'w',
    };
  }

  const fixedTotal = children.reduce((sum, child) => sum + (child.fixedSizeMm?.heightMm ?? 0), 0);
  return {
    availableMain: Math.max(0, paddedBox.h - gapTotal - fixedTotal),
    mainAxisKey: 'heightMm',
    axis: 'h',
  };
}

/**
 * The asset's *effective* (on-screen) aspect ratio: raw pixel aspect, inverted when
 * imageRotationDeg is 90/270 since rotating swaps which pixel axis reads as width on screen.
 * specificSizeMm is always the on-screen size (see the "Image rotation orientation"
 * requirement), so any derivation from/to it must use this, not the raw asset aspect.
 */
function resolveAspectRatio(asset: ImageAsset | undefined, imageRotationDeg?: ImageRotationDeg): number {
  const rawAspect = asset && asset.heightPx > 0 ? asset.widthPx / asset.heightPx : 1;
  return imageRotationDeg === 90 || imageRotationDeg === 270 ? 1 / rawAspect : rawAspect;
}

/**
 * Computes the next SpecificSizeMm given a width/height edit (or clear, when valueMm is null).
 * Only the axis the user explicitly typed into is authoritative — the other is derived from it
 * plus the asset's aspect ratio, unless both axes are explicit (lockedAxis: 'both'), in which
 * case the image stretches to fit both exactly. Both fields are always fully resolved (never
 * partial) so the pure layout-engine can use them as a size floor without needing asset data.
 */
function resolveSpecificSizeMm(
  current: SpecificSizeMm | undefined,
  axis: 'width' | 'height',
  valueMm: number | null,
  aspectRatio: number,
): SpecificSizeMm | undefined {
  if (valueMm == null) {
    if (!current) {
      return undefined;
    }
    if (axis === 'width') {
      if (current.lockedAxis === 'width') {
        return undefined;
      }
      return { widthMm: current.heightMm * aspectRatio, heightMm: current.heightMm, lockedAxis: 'height' };
    }
    if (current.lockedAxis === 'height') {
      return undefined;
    }
    return { widthMm: current.widthMm, heightMm: current.widthMm / aspectRatio, lockedAxis: 'width' };
  }

  const clampedValueMm = Math.max(0.1, valueMm);
  if (axis === 'width') {
    const otherExplicit = current?.lockedAxis === 'height' || current?.lockedAxis === 'both';
    const heightMm = otherExplicit ? current!.heightMm : clampedValueMm / aspectRatio;
    return { widthMm: clampedValueMm, heightMm, lockedAxis: otherExplicit ? 'both' : 'width' };
  }

  const otherExplicit = current?.lockedAxis === 'width' || current?.lockedAxis === 'both';
  const widthMm = otherExplicit ? current!.widthMm : clampedValueMm * aspectRatio;
  return { widthMm, heightMm: clampedValueMm, lockedAxis: otherExplicit ? 'both' : 'height' };
}

function findParentAndIndex(node: LayoutNode, targetId: string): { parent: LayoutNode; index: number } | null {
  const children = node.children ?? [];
  const index = children.findIndex((child) => child.id === targetId);
  if (index !== -1) {
    return { parent: node, index };
  }

  for (const child of children) {
    const found = findParentAndIndex(child, targetId);
    if (found) {
      return found;
    }
  }

  return null;
}

/** A snapshot of one imageSlot's image assignment, scaling rule, rotation, padding, and (when the
 * scaling rule is `specificSize`) its specific-size dimensions -- the exact set the
 * `slot-clipboard` capability copies/pastes. Captured by value (not a node/id reference) so it
 * survives edits to, or deletion of, the slot it was copied from. */
export interface CopiedSlotProperties {
  imageAssetId: string | null;
  scalingRule: ScalingRule;
  imageRotationDeg: ImageRotationDeg;
  paddingMm: Sides;
  specificSizeMm: SpecificSizeMm | undefined;
}

export function captureSlotProperties(sourceNode: LayoutNode, imageAssetId: string | undefined): CopiedSlotProperties {
  const scalingRule = sourceNode.imageSlotConfig?.scalingRule ?? 'fitInParent';
  return {
    imageAssetId: imageAssetId ?? null,
    scalingRule,
    imageRotationDeg: sourceNode.imageSlotConfig?.imageRotationDeg ?? 0,
    paddingMm: {
      top: sourceNode.paddingMm?.top ?? 0,
      right: sourceNode.paddingMm?.right ?? 0,
      bottom: sourceNode.paddingMm?.bottom ?? 0,
      left: sourceNode.paddingMm?.left ?? 0,
    },
    specificSizeMm: scalingRule === 'specificSize' ? sourceNode.imageSlotConfig?.specificSizeMm : undefined,
  };
}

function applySlotPropertiesToNode(node: LayoutNode, targetIds: Set<string>, properties: CopiedSlotProperties): LayoutNode {
  const children = node.children?.map((child) => applySlotPropertiesToNode(child, targetIds, properties));
  const nextNode = children ? { ...node, children } : node;

  if (!targetIds.has(node.id)) {
    return nextNode;
  }

  return {
    ...nextNode,
    paddingMm: properties.paddingMm,
    imageSlotConfig: {
      ...nextNode.imageSlotConfig,
      scalingRule: properties.scalingRule,
      imageRotationDeg: properties.imageRotationDeg,
      specificSizeMm: properties.specificSizeMm,
    },
  };
}

/**
 * §4.1.1 — when a slot's minimum required size grows (e.g. a specificSize is set), borrows
 * space from the one adjacent sibling on the growing side so the divider between them lands
 * exactly on the new minimum instead of leaving the slot under-sized. A no-op if the slot isn't
 * inside a horizontal/vertical parent, is already big enough, or the divider is locked/maxed —
 * any leftover deficit is left for the caller to flag (can't be satisfied by the template).
 */
function growSlotToMinimum(sheetSize: SheetSize, page: EPPProjectPage, slotNodeId: string): LayoutNode {
  const parentInfo = findParentAndIndex(page.rootNode, slotNodeId);
  if (!parentInfo) {
    return page.rootNode;
  }

  const { parent, index } = parentInfo;
  if (parent.type !== 'horizontal' && parent.type !== 'vertical') {
    return page.rootNode;
  }

  const children = parent.children ?? [];
  const slotNode = children[index];
  if (!slotNode || children.length < 2) {
    return page.rootNode;
  }

  const { availableMain, mainAxisKey, axis } = computeAvailableMainSize(sheetSize, page, parent);
  const pageBox = createPageBoxMm(sheetSize, page.pageConfig.orientation);
  const slotBox = resolveLayout(page.rootNode, pageBox).get(slotNodeId);
  if (!slotBox) {
    return page.rootNode;
  }

  const requiredMm = computeMinRequiredMainSizeMm(slotNode, axis);
  const currentMm = axis === 'w' ? slotBox.w : slotBox.h;
  const deficitMm = requiredMm - currentMm;
  if (deficitMm <= 0.001) {
    return page.rootNode;
  }

  const hasNextSibling = index < children.length - 1;
  const siblingIndexA = hasNextSibling ? index : index - 1;
  const deltaMm = hasNextSibling ? deficitMm : -deficitMm;
  const resizedChildren = resizeAdjacentSiblings(children, siblingIndexA, deltaMm, availableMain, mainAxisKey, axis);

  return updateChildrenForNode(page.rootNode, parent.id, () => resizedChildren);
}

export interface DocumentState {
  sheetSize: SheetSize;
  pages: EPPProjectPage[];
}

export function createInitialDocumentState(): DocumentState {
  return {
    sheetSize: { ...DEFAULT_SHEET_SIZE },
    pages: [createDefaultPage('page-1')],
  };
}

export interface DocumentSlice {
  document: DocumentState;
  updateSheetSize: (patch: Partial<SheetSize>) => void;
  updatePageConfig: (pageId: string, patch: Partial<ProjectPageConfig>) => void;
  updateLayoutNode: (pageId: string, nodeId: string, patch: Partial<LayoutNode>) => void;
  updateGridNodeConfig: (
    pageId: string,
    nodeId: string,
    patch: {
      gridConfig?: Partial<GridConfig>;
      gapMm?: number;
      paddingMm?: Partial<Sides>;
    },
  ) => void;
  setContainerChildCount: (pageId: string, nodeId: string, count: number) => void;
  normalizePageForSimpleMode: (pageId: string) => void;
  retypeLayoutNode: (pageId: string, nodeId: string, nextType: NestedNodeType) => void;
  addNestedChildNode: (pageId: string, parentNodeId: string, childType: 'imageSlot' | 'horizontal' | 'vertical' | 'grid' | 'freeformCanvas') => void;
  removeLayoutNode: (pageId: string, nodeId: string) => void;
  assignImageToSlot: (pageId: string, nodeId: string, imageAssetId: string) => void;
  setSlotSpecificSize: (pageId: string, nodeId: string, axis: 'width' | 'height', valueMm: number | null) => void;
  rotateSlotImage: (pageId: string, nodeId: string) => void;
  clearImageFromSlot: (pageId: string, nodeId: string) => void;
  /** Applies a copied/pasted `CopiedSlotProperties` snapshot to every target imageSlot in one
   * undo step. No-ops (no `set()` call, no undo entry) when `targetNodeIds` is empty. */
  applySlotProperties: (pageId: string, properties: CopiedSlotProperties, targetNodeIds: string[]) => void;
  /** Applies `nodeId`'s own image/scaling rule/rotation/padding directly to every other imageSlot
   * sharing its parent container -- independent of the copy/paste clipboard. */
  copySlotPropertiesToSiblings: (pageId: string, nodeId: string) => void;
  /** Applies `nodeId`'s own image/scaling rule/rotation/padding directly to every other imageSlot
   * on the page, regardless of nesting -- independent of the copy/paste clipboard. */
  copySlotPropertiesToPage: (pageId: string, nodeId: string) => void;
  resizeSiblingsByDrag: (pageId: string, parentNodeId: string, siblingIndexA: number, deltaMm: number) => void;
  /** Returns the id of the newly created shadow imageSlot node (`FreeformElement.imageNodeId`),
   * so a caller that needs to select the placed element afterward (e.g. tap-to-place) doesn't
   * have to re-derive it. */
  addFreeformElement: (
    pageId: string,
    freeformCanvasNodeId: string,
    imageAssetId: string,
    centerAtMm?: { xMm: number; yMm: number },
  ) => string;
  removeFreeformElement: (pageId: string, freeformCanvasNodeId: string, freeformElementId: string) => void;
  updateFreeformElementTransform: (
    pageId: string,
    freeformCanvasNodeId: string,
    freeformElementId: string,
    patch: Partial<FreeformTransform>,
  ) => void;
  applyTemplate: (pageId: string, template: EPPTemplate) => void;
  linkPageToTemplate: (pageId: string, templateId: string) => void;
  exportTemplate: (pageId: string) => EPPTemplate;
}

interface DocumentSliceDependencies {
  document: DocumentState;
  imagePool: ImageAsset[];
}

export function createDocumentSlice(
  set: (
    updater: (state: DocumentSliceDependencies) => Partial<DocumentSliceDependencies>,
  ) => void,
  get: () => DocumentSliceDependencies,
): DocumentSlice {
  const applySlotPropertiesAction = (pageId: string, properties: CopiedSlotProperties, targetNodeIds: string[]) => {
    if (targetNodeIds.length === 0) {
      return;
    }

    const targetIdSet = new Set(targetNodeIds);
    set((state) => ({
      document: {
        ...state.document,
        pages: state.document.pages.map((entry) => {
          if (entry.id !== pageId) {
            return entry;
          }

          const assignments = { ...entry.assignments };
          for (const targetNodeId of targetNodeIds) {
            if (properties.imageAssetId) {
              assignments[targetNodeId] = properties.imageAssetId;
            } else {
              delete assignments[targetNodeId];
            }
          }

          return {
            ...entry,
            rootNode: applySlotPropertiesToNode(entry.rootNode, targetIdSet, properties),
            assignments,
          };
        }),
      },
    }));
  };

  return {
    document: createInitialDocumentState(),
    updateSheetSize: (patch) => {
      set((state) => ({
        document: {
          ...state.document,
          sheetSize: {
            ...state.document.sheetSize,
            ...patch,
            customSizeMm: patch.customSizeMm ?? state.document.sheetSize.customSizeMm,
          },
        },
      }));
    },
    updatePageConfig: (pageId, patch) => {
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  pageConfig: {
                    ...page.pageConfig,
                    ...patch,
                  },
                }
              : page,
          ),
        },
      }));
    },
    updateLayoutNode: (pageId, nodeId, patch) => {
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  rootNode: updateNodeById(page.rootNode, nodeId, patch),
                }
              : page,
          ),
        },
      }));
    },
    updateGridNodeConfig: (pageId, nodeId, patch) => {
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((page) => {
            if (page.id !== pageId) {
              return page;
            }

            const rootNode = updateGridNodeById(page.rootNode, nodeId, patch);
            return {
              ...page,
              rootNode,
              assignments: filterAssignmentsForRootNode(rootNode, page.assignments),
            };
          }),
        },
      }));
    },
    setContainerChildCount: (pageId, nodeId, count) => {
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((page) => {
            if (page.id !== pageId) {
              return page;
            }

            const rootNode = updateContainerChildCountById(page.rootNode, nodeId, count);
            return {
              ...page,
              rootNode,
              assignments: filterAssignmentsForRootNode(rootNode, page.assignments),
            };
          }),
        },
      }));
    },
    normalizePageForSimpleMode: (pageId) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((entry) =>
            entry.id === pageId
              ? (() => {
                  const nextSlotId = createSlotIdGenerator(entry.rootNode);
                  const rootNode = normalizeRootForSimpleMode(entry.rootNode, nextSlotId);
                  return {
                    ...entry,
                    rootNode,
                    assignments: filterAssignmentsForRootNode(rootNode, entry.assignments),
                  };
                })()
              : entry,
          ),
        },
      }));
    },
    retypeLayoutNode: (pageId, nodeId, nextType) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      const nextSlotId = createSlotIdGenerator(page.rootNode);
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((entry) => {
            if (entry.id !== pageId) {
              return entry;
            }

            const rootNode = retypeNodeById(entry.rootNode, nodeId, nextType, nextSlotId);
            return {
              ...entry,
              rootNode,
              assignments: filterAssignmentsForRootNode(rootNode, entry.assignments),
            };
          }),
        },
      }));
    },
    addNestedChildNode: (pageId, parentNodeId, childType) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      const nextSlotId = createSlotIdGenerator(page.rootNode);
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((entry) =>
            entry.id === pageId
              ? {
                  ...entry,
                  rootNode: addChildNodeById(entry.rootNode, parentNodeId, childType, nextSlotId),
                }
              : entry,
          ),
        },
      }));
    },
    removeLayoutNode: (pageId, nodeId) => {
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((entry) => {
            if (entry.id !== pageId || entry.rootNode.id === nodeId) {
              return entry;
            }

            const rootNode = removeNodeById(entry.rootNode, nodeId);
            return {
              ...entry,
              rootNode,
              assignments: filterAssignmentsForRootNode(rootNode, entry.assignments),
            };
          }),
        },
      }));
    },
    assignImageToSlot: (pageId, nodeId, imageAssetId) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      const slotNode = page ? findNodeById(page.rootNode, nodeId) : undefined;
      const specificSizeMm = slotNode?.imageSlotConfig?.specificSizeMm;

      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((entry) => {
            if (entry.id !== pageId) {
              return entry;
            }

            // A specificSize slot whose non-locked axis was derived from the *previous* image's
            // aspect ratio needs to be re-derived for the newly assigned one, so the image keeps
            // fitting its explicitly-set axis instead of quietly carrying a stale dimension.
            const rootNode =
              specificSizeMm && specificSizeMm.lockedAxis !== 'both'
                ? updateNodeById(entry.rootNode, nodeId, {
                    imageSlotConfig: {
                      ...slotNode!.imageSlotConfig,
                      specificSizeMm: resolveSpecificSizeMm(
                        specificSizeMm,
                        specificSizeMm.lockedAxis,
                        specificSizeMm.lockedAxis === 'width' ? specificSizeMm.widthMm : specificSizeMm.heightMm,
                        resolveAspectRatio(
                          get().imagePool.find((asset) => asset.id === imageAssetId),
                          slotNode?.imageSlotConfig?.imageRotationDeg,
                        ),
                      ),
                    },
                  })
                : entry.rootNode;

            return {
              ...entry,
              rootNode,
              assignments: assignImageToPage(entry, nodeId, imageAssetId),
            };
          }),
        },
      }));
    },
    clearImageFromSlot: (pageId, nodeId) => {
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  assignments: clearImageFromPage(page, nodeId),
                }
              : page,
          ),
        },
      }));
    },
    setSlotSpecificSize: (pageId, nodeId, axis, valueMm) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      const slotNode = findNodeById(page.rootNode, nodeId);
      if (!slotNode || slotNode.type !== 'imageSlot') {
        throw new Error(`Node ${nodeId} is not an imageSlot.`);
      }

      const asset = get().imagePool.find((entry) => entry.id === page.assignments[nodeId]);
      const nextSpecificSizeMm = resolveSpecificSizeMm(
        slotNode.imageSlotConfig?.specificSizeMm,
        axis,
        valueMm,
        resolveAspectRatio(asset, slotNode.imageSlotConfig?.imageRotationDeg),
      );

      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((entry) =>
            entry.id === pageId
              ? {
                  ...entry,
                  rootNode: updateNodeById(entry.rootNode, nodeId, {
                    imageSlotConfig: {
                      ...slotNode.imageSlotConfig,
                      scalingRule: 'specificSize',
                      specificSizeMm: nextSpecificSizeMm,
                    },
                  }),
                }
              : entry,
          ),
        },
      }));

      // §4.1.1 — reposition the dividers around this slot right away so they reflect the new
      // minimum, instead of waiting for the user to drag one manually.
      const updatedPage = get().document.pages.find((entry) => entry.id === pageId);
      if (!updatedPage) {
        return;
      }
      const grownRootNode = growSlotToMinimum(get().document.sheetSize, updatedPage, nodeId);
      if (grownRootNode !== updatedPage.rootNode) {
        set((state) => ({
          document: {
            ...state.document,
            pages: state.document.pages.map((entry) => (entry.id === pageId ? { ...entry, rootNode: grownRootNode } : entry)),
          },
        }));
      }
    },
    rotateSlotImage: (pageId, nodeId) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      const slotNode = findNodeById(page.rootNode, nodeId);
      if (!slotNode || slotNode.type !== 'imageSlot') {
        throw new Error(`Node ${nodeId} is not an imageSlot.`);
      }

      const nextRotationDeg = (((slotNode.imageSlotConfig?.imageRotationDeg ?? 0) + 90) % 360) as ImageRotationDeg;

      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((entry) =>
            entry.id === pageId
              ? {
                  ...entry,
                  rootNode: updateNodeById(entry.rootNode, nodeId, {
                    imageSlotConfig: {
                      ...slotNode.imageSlotConfig,
                      imageRotationDeg: nextRotationDeg,
                    },
                  }),
                }
              : entry,
          ),
        },
      }));
    },
    applySlotProperties: applySlotPropertiesAction,
    copySlotPropertiesToSiblings: (pageId, nodeId) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      const sourceNode = findNodeById(page.rootNode, nodeId);
      if (!sourceNode || sourceNode.type !== 'imageSlot') {
        throw new Error(`Node ${nodeId} is not an imageSlot.`);
      }

      const parentInfo = findParentAndIndex(page.rootNode, nodeId);
      const siblings = parentInfo?.parent.children ?? [];
      const targetNodeIds = siblings
        .filter((sibling) => sibling.id !== nodeId && sibling.type === 'imageSlot')
        .map((sibling) => sibling.id);

      applySlotPropertiesAction(pageId, captureSlotProperties(sourceNode, page.assignments[nodeId]), targetNodeIds);
    },
    copySlotPropertiesToPage: (pageId, nodeId) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      const sourceNode = findNodeById(page.rootNode, nodeId);
      if (!sourceNode || sourceNode.type !== 'imageSlot') {
        throw new Error(`Node ${nodeId} is not an imageSlot.`);
      }

      const slotIds = new Set<string>();
      collectImageSlotIds(page.rootNode, slotIds);
      slotIds.delete(nodeId);

      applySlotPropertiesAction(pageId, captureSlotProperties(sourceNode, page.assignments[nodeId]), [...slotIds]);
    },
    resizeSiblingsByDrag: (pageId, parentNodeId, siblingIndexA, deltaMm) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      const parentNode = findNodeById(page.rootNode, parentNodeId);
      if (!parentNode) {
        throw new Error(`Parent node ${parentNodeId} does not exist.`);
      }

      const { availableMain, mainAxisKey, axis } = computeAvailableMainSize(get().document.sheetSize, page, parentNode);
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((entry) =>
            entry.id === pageId
              ? {
                  ...entry,
                  rootNode: updateChildrenForNode(entry.rootNode, parentNodeId, (children) =>
                    resizeAdjacentSiblings(children, siblingIndexA, deltaMm, availableMain, mainAxisKey, axis),
                  ),
                }
              : entry,
          ),
        },
      }));
    },
    addFreeformElement: (pageId, freeformCanvasNodeId, imageAssetId, centerAtMm) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      const freeformCanvasNode = findNodeById(page.rootNode, freeformCanvasNodeId);
      if (!freeformCanvasNode || freeformCanvasNode.type !== 'freeformCanvas') {
        throw new Error(`Node ${freeformCanvasNodeId} is not a freeformCanvas node.`);
      }

      const pageBox = createPageBoxMm(get().document.sheetSize, page.pageConfig.orientation);
      const nodeBox = resolveLayout(page.rootNode, pageBox).get(freeformCanvasNodeId);
      if (!nodeBox) {
        throw new Error(`Could not resolve layout for freeformCanvas node ${freeformCanvasNodeId}.`);
      }

      const defaultSizeMm = Math.max(MIN_FREEFORM_SIZE_MM, Math.min(nodeBox.w, nodeBox.h) / 3);
      const center = centerAtMm ?? { xMm: nodeBox.w / 2, yMm: nodeBox.h / 2 };
      const rawTransform: FreeformTransform = {
        xMm: center.xMm - defaultSizeMm / 2,
        yMm: center.yMm - defaultSizeMm / 2,
        widthMm: defaultSizeMm,
        heightMm: defaultSizeMm,
        rotationDeg: 0,
        lockAspectRatio: true,
      };
      const clampedPosition = clampFreeformPosition(rawTransform, { w: nodeBox.w, h: nodeBox.h });
      const transform: FreeformTransform = { ...rawTransform, ...clampedPosition };

      const nextSlotId = createSlotIdGenerator(page.rootNode);
      const imageSlotId = nextSlotId();
      const imageSlot = createImageSlot(imageSlotId);
      const element: FreeformElement = {
        id: crypto.randomUUID(),
        imageNodeId: imageSlotId,
        zIndex: freeformCanvasNode.freeformElements?.length ?? 0,
        transform,
      };

      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((entry) => {
            if (entry.id !== pageId) {
              return entry;
            }

            return {
              ...entry,
              rootNode: addFreeformElementToNode(entry.rootNode, freeformCanvasNodeId, imageSlot, element),
              assignments: { ...entry.assignments, [imageSlotId]: imageAssetId },
            };
          }),
        },
      }));

      return imageSlotId;
    },
    removeFreeformElement: (pageId, freeformCanvasNodeId, freeformElementId) => {
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((page) => {
            if (page.id !== pageId) {
              return page;
            }

            const freeformCanvasNode = findNodeById(page.rootNode, freeformCanvasNodeId);
            const targetElement = freeformCanvasNode?.freeformElements?.find((element) => element.id === freeformElementId);
            let rootNode = removeFreeformElementEntryById(page.rootNode, freeformCanvasNodeId, freeformElementId);
            const assignments = { ...page.assignments };
            if (targetElement) {
              rootNode = removeNodeById(rootNode, targetElement.imageNodeId);
              delete assignments[targetElement.imageNodeId];
            }

            return { ...page, rootNode, assignments };
          }),
        },
      }));
    },
    updateFreeformElementTransform: (pageId, freeformCanvasNodeId, freeformElementId, patch) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      const freeformCanvasNode = findNodeById(page.rootNode, freeformCanvasNodeId);
      const currentElement = freeformCanvasNode?.freeformElements?.find((element) => element.id === freeformElementId);
      if (!currentElement) {
        throw new Error(`Freeform element ${freeformElementId} does not exist.`);
      }

      const pageBox = createPageBoxMm(get().document.sheetSize, page.pageConfig.orientation);
      const nodeBox = resolveLayout(page.rootNode, pageBox).get(freeformCanvasNodeId);
      if (!nodeBox) {
        throw new Error(`Could not resolve layout for freeformCanvas node ${freeformCanvasNodeId}.`);
      }

      const mergedTransform: FreeformTransform = { ...currentElement.transform, ...patch };
      const sizedTransform: FreeformTransform = {
        ...mergedTransform,
        widthMm: Math.max(MIN_FREEFORM_SIZE_MM, mergedTransform.widthMm),
        heightMm: Math.max(MIN_FREEFORM_SIZE_MM, mergedTransform.heightMm),
      };
      const clampedPosition = clampFreeformPosition(sizedTransform, { w: nodeBox.w, h: nodeBox.h });
      const nextTransform: FreeformTransform = { ...sizedTransform, ...clampedPosition };

      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((entry) =>
            entry.id === pageId
              ? { ...entry, rootNode: setFreeformElementTransformById(entry.rootNode, freeformCanvasNodeId, freeformElementId, nextTransform) }
              : entry,
          ),
        },
      }));
    },
    applyTemplate: (pageId, template) => {
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((page) => {
            if (page.id !== pageId) {
              return page;
            }

            const reconciled = reconcileTemplateUpdate(page.rootNode, template.rootNode, page.assignments);
            return {
              ...page,
              pageConfig: { orientation: template.page.orientation, dpi: template.page.dpi },
              templateRef: template.id,
              rootNode: reconciled.rootNode,
              assignments: reconciled.assignments,
            };
          }),
        },
      }));
    },
    linkPageToTemplate: (pageId, templateId) => {
      set((state) => ({
        document: {
          ...state.document,
          pages: state.document.pages.map((page) =>
            page.id === pageId ? { ...page, templateRef: templateId } : page,
          ),
        },
      }));
    },
    exportTemplate: (pageId) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      return createTemplateFromPage(get().document.sheetSize, page);
    },
  };
}
