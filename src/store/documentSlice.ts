// @spec OPENSPEC.md §2.3 — document slice, pageConfig per page, assignImageToSlot swap logic
import {
  applyPadding,
  reconcileTemplateUpdate,
  resolveLayout,
  resizeSiblingsByDrag as resizeAdjacentSiblings,
  type EPPProjectPage,
  type EPPTemplate,
  type GridConfig,
  type LayoutNode,
  type PageConfig,
  type Sides,
} from '@epp/layout-engine';

import { getEppApi } from '../lib/ipc-client.js';
import { createPageBoxMm } from '../lib/page.js';

const DEFAULT_PAGE_CONFIG: PageConfig = {
  sizePreset: 'A4',
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

function createSlotIdGenerator(rootNode: LayoutNode): () => string {
  const slotIds = new Set<string>();
  collectImageSlotIds(rootNode, slotIds);
  let currentMax = [...slotIds].reduce((max, slotId) => {
    const parsed = parseSlotSequence(slotId);
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

  return {
    ...createImageSlot(rootNode.id),
    paddingMm: { top: 5, right: 5, bottom: 5, left: 5 },
  };
}

function firstAssignedImageAssetId(page: EPPProjectPage): string | undefined {
  if (page.assignments[page.rootNode.id]) {
    return page.assignments[page.rootNode.id];
  }
  const slotIds = collectImageSlotNodes(page.rootNode).map((node) => node.id);
  for (const slotId of slotIds) {
    const assigned = page.assignments[slotId];
    if (assigned) {
      return assigned;
    }
  }
  return undefined;
}

function setSimpleRootTypeForPage(
  page: EPPProjectPage,
  nextType: Extract<NestedNodeType, 'grid' | 'horizontal' | 'vertical' | 'imageSlot'>,
): { rootNode: LayoutNode; assignments: Record<string, string> } {
  const nextSlotId = createSlotIdGenerator(page.rootNode);
  const currentRoot = normalizeRootForSimpleMode(page.rootNode, nextSlotId);

  if (nextType === 'imageSlot') {
    const assignedImageAssetId = firstAssignedImageAssetId(page);
    return {
      rootNode: {
        ...createImageSlot(currentRoot.id),
        paddingMm: currentRoot.paddingMm ?? { top: 5, right: 5, bottom: 5, left: 5 },
        imageSlotConfig:
          currentRoot.type === 'imageSlot'
            ? currentRoot.imageSlotConfig
            : { scalingRule: 'fitInParent' },
      },
      assignments: assignedImageAssetId ? { [currentRoot.id]: assignedImageAssetId } : {},
    };
  }

  const currentSlots = currentRoot.type === 'imageSlot' ? [] : (currentRoot.children ?? []).map(cloneAsSimpleImageSlot);
  const children = currentSlots.length > 0 ? currentSlots : createDefaultChildren(nextSlotId);
  const assignments: Record<string, string> = {};
  if (currentRoot.type === 'imageSlot') {
    const assignedImageAssetId = page.assignments[currentRoot.id];
    if (assignedImageAssetId) {
      assignments[children[0].id] = assignedImageAssetId;
    }
  } else {
    Object.assign(assignments, filterAssignmentsForRootNode({ ...currentRoot, children }, page.assignments));
  }

  if (nextType === 'grid') {
    const gridConfig =
      currentRoot.type === 'grid'
        ? normalizeGridConfig(currentRoot.gridConfig)
        : {
            rows: 1,
            columns: Math.max(children.length, 2),
            autoFit: false,
            rowGapMm: undefined,
            columnGapMm: undefined,
          };
    const normalizedChildren = reconcileGridChildren(children, Math.max(1, gridConfig.rows * gridConfig.columns));
    return {
      rootNode: {
        id: currentRoot.id,
        type: 'grid',
        gapMm: currentRoot.gapMm ?? 3,
        paddingMm: currentRoot.paddingMm ?? { top: 5, right: 5, bottom: 5, left: 5 },
        gridConfig,
        children: normalizedChildren,
      },
      assignments: filterAssignmentsForRootNode(
        {
          id: currentRoot.id,
          type: 'grid',
          gapMm: currentRoot.gapMm ?? 3,
          paddingMm: currentRoot.paddingMm ?? { top: 5, right: 5, bottom: 5, left: 5 },
          gridConfig,
          children: normalizedChildren,
        },
        assignments,
      ),
    };
  }

  return {
    rootNode: {
      id: currentRoot.id,
      type: nextType,
      gapMm: currentRoot.gapMm ?? 3,
      paddingMm: currentRoot.paddingMm ?? { top: 5, right: 5, bottom: 5, left: 5 },
      children,
    },
    assignments,
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

function findNodeById(node: LayoutNode, nodeId: string): LayoutNode | undefined {
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
  childType: Exclude<NestedNodeType, 'freeformCanvas'>,
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

export function assignImageToPage(
  page: EPPProjectPage,
  nodeId: string,
  imageAssetId: string,
  source: 'library' | 'page' = 'library',
): Record<string, string> {
  const nextAssignments = { ...page.assignments };

  if (source === 'library') {
    nextAssignments[nodeId] = imageAssetId;
    return nextAssignments;
  }

  const currentOccupant = nextAssignments[nodeId];
  const sourceNodeId = Object.entries(nextAssignments).find(
    ([slotId, assignedImageId]) => assignedImageId === imageAssetId && slotId !== nodeId,
  )?.[0];

  if (sourceNodeId) {
    if (currentOccupant) {
      nextAssignments[sourceNodeId] = currentOccupant;
    } else {
      delete nextAssignments[sourceNodeId];
    }
  }

  nextAssignments[nodeId] = imageAssetId;
  return nextAssignments;
}

export function clearImageFromPage(page: EPPProjectPage, nodeId: string): Record<string, string> {
  const nextAssignments = { ...page.assignments };
  delete nextAssignments[nodeId];
  return nextAssignments;
}

function createTemplateFromPage(page: EPPProjectPage): EPPTemplate {
  return {
    schemaVersion: '1.0.0',
    id: crypto.randomUUID(),
    name: `Template ${page.id}`,
    page: { ...page.pageConfig },
    rootNode: cloneLayoutNode(page.rootNode),
  };
}

function computeAvailableMainSize(page: EPPProjectPage, parentNode: LayoutNode): {
  availableMain: number;
  mainAxisKey: 'widthMm' | 'heightMm';
  axis: 'w' | 'h';
} {
  if (parentNode.type !== 'horizontal' && parentNode.type !== 'vertical') {
    throw new Error(`resizeSiblingsByDrag only supports horizontal or vertical parent nodes. Received ${parentNode.type}.`);
  }

  const pageBox = createPageBoxMm(page.pageConfig);
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

export interface DocumentState {
  pages: EPPProjectPage[];
}

export interface DocumentSlice {
  document: DocumentState;
  updatePageConfig: (pageId: string, patch: Partial<PageConfig>) => void;
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
  normalizePageForSimpleMode: (pageId: string) => void;
  setSimpleRootType: (pageId: string, nextType: 'grid' | 'horizontal' | 'vertical' | 'imageSlot') => void;
  retypeLayoutNode: (pageId: string, nodeId: string, nextType: NestedNodeType) => void;
  addNestedChildNode: (pageId: string, parentNodeId: string, childType: 'imageSlot' | 'horizontal' | 'vertical' | 'grid') => void;
  removeLayoutNode: (pageId: string, nodeId: string) => void;
  assignImageToSlot: (pageId: string, nodeId: string, imageAssetId: string) => void;
  clearImageFromSlot: (pageId: string, nodeId: string) => void;
  resizeSiblingsByDrag: (pageId: string, parentNodeId: string, siblingIndexA: number, deltaMm: number) => void;
  applyTemplate: (pageId: string, template: EPPTemplate) => void;
  exportTemplate: (pageId: string) => EPPTemplate;
  exportPdf: () => Promise<Uint8Array>;
}

interface DocumentSliceDependencies {
  document: DocumentState;
}

export function createDocumentSlice(
  set: (
    updater: (state: DocumentSliceDependencies) => Partial<DocumentSliceDependencies>,
  ) => void,
  get: () => DocumentSliceDependencies,
): DocumentSlice {
  return {
    document: {
      pages: [createDefaultPage('page-1')],
    },
    updatePageConfig: (pageId, patch) => {
      set((state) => ({
        document: {
          pages: state.document.pages.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  pageConfig: {
                    ...page.pageConfig,
                    ...patch,
                    customSizeMm: patch.customSizeMm ?? page.pageConfig.customSizeMm,
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
    normalizePageForSimpleMode: (pageId) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      set((state) => ({
        document: {
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
    setSimpleRootType: (pageId, nextType) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      set((state) => ({
        document: {
          pages: state.document.pages.map((entry) => {
            if (entry.id !== pageId) {
              return entry;
            }
            const nextState = setSimpleRootTypeForPage(entry, nextType);
            return {
              ...entry,
              rootNode: nextState.rootNode,
              assignments: nextState.assignments,
            };
          }),
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
      set((state) => ({
        document: {
          pages: state.document.pages.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  assignments: assignImageToPage(page, nodeId, imageAssetId),
                }
              : page,
          ),
        },
      }));
    },
    clearImageFromSlot: (pageId, nodeId) => {
      set((state) => ({
        document: {
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
    resizeSiblingsByDrag: (pageId, parentNodeId, siblingIndexA, deltaMm) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      const parentNode = findNodeById(page.rootNode, parentNodeId);
      if (!parentNode) {
        throw new Error(`Parent node ${parentNodeId} does not exist.`);
      }

      const { availableMain, mainAxisKey, axis } = computeAvailableMainSize(page, parentNode);
      set((state) => ({
        document: {
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
    applyTemplate: (pageId, template) => {
      set((state) => ({
        document: {
          pages: state.document.pages.map((page) => {
            if (page.id !== pageId) {
              return page;
            }

            const reconciled = reconcileTemplateUpdate(page.rootNode, template.rootNode, page.assignments);
            return {
              ...page,
              pageConfig: { ...template.page },
              templateRef: template.id,
              rootNode: reconciled.rootNode,
              assignments: reconciled.assignments,
            };
          }),
        },
      }));
    },
    exportTemplate: (pageId) => {
      const page = get().document.pages.find((entry) => entry.id === pageId);
      if (!page) {
        throw new Error(`Page ${pageId} does not exist.`);
      }

      return createTemplateFromPage(page);
    },
    exportPdf: async () => {
      const project = {
        schemaVersion: '1.0.0' as const,
        id: 'unsaved-project',
        name: 'Unsaved project',
        pages: get().document.pages,
        imagePool: [],
      };
      return getEppApi().pdf.export(project);
    },
  };
}
