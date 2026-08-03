// @spec OPENSPEC.md §4.1, §4.1.1 — applyPadding, distributeChildren, resolveCrossAxis, resizeSiblingsByDrag
import { resolveDimensions } from './grid.js';
import type { AlignmentConfig, BoxMm, LayoutNode, Sides } from './types.js';

export const MIN_SIZE_RATIO_MM = 10;

type MainAxisKey = 'widthMm' | 'heightMm';
type Axis = 'w' | 'h';
type Direction = 'horizontal' | 'vertical';

const DEFAULT_ALIGNMENT: Required<AlignmentConfig> = {
  horizontal: 'expand',
  vertical: 'expand',
};

function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    return Math.min(min, Math.max(max, value));
  }

  return Math.min(max, Math.max(min, value));
}

function normalizeAlignment(alignment?: AlignmentConfig): Required<AlignmentConfig> {
  return {
    horizontal: alignment?.horizontal ?? DEFAULT_ALIGNMENT.horizontal,
    vertical: alignment?.vertical ?? DEFAULT_ALIGNMENT.vertical,
  };
}

function paddingAlongAxis(padding: Partial<Sides> | undefined, axis: Axis): number {
  if (axis === 'w') {
    return (padding?.left ?? 0) + (padding?.right ?? 0);
  }

  return (padding?.top ?? 0) + (padding?.bottom ?? 0);
}

export function applyPadding(box: BoxMm, padding?: Partial<Sides>): BoxMm {
  const normalized = {
    top: padding?.top ?? 0,
    right: padding?.right ?? 0,
    bottom: padding?.bottom ?? 0,
    left: padding?.left ?? 0,
  };

  return {
    x: box.x + normalized.left,
    y: box.y + normalized.top,
    w: Math.max(0, box.w - normalized.left - normalized.right),
    h: Math.max(0, box.h - normalized.top - normalized.bottom),
  };
}

export function isDividerLocked(children: LayoutNode[], index: number, mainAxisKey: MainAxisKey): boolean {
  return (
    children[index]?.fixedSizeMm?.[mainAxisKey] != null ||
    children[index + 1]?.fixedSizeMm?.[mainAxisKey] != null
  );
}

export function computeMinRequiredMainSizeMm(node: LayoutNode, axis: Axis): number {
  const axisKey: MainAxisKey = axis === 'w' ? 'widthMm' : 'heightMm';
  if (node.type === 'imageSlot' || node.type === 'freeformCanvas') {
    if (node.type === 'imageSlot' && node.imageSlotConfig?.scalingRule === 'specificSize' && node.imageSlotConfig.specificSizeMm) {
      const specificValue = axis === 'w' ? node.imageSlotConfig.specificSizeMm.widthMm : node.imageSlotConfig.specificSizeMm.heightMm;
      return Math.max(specificValue, node.fixedSizeMm?.[axisKey] ?? 0, MIN_SIZE_RATIO_MM);
    }
    return node.fixedSizeMm?.[axisKey] ?? MIN_SIZE_RATIO_MM;
  }

  const children = node.children ?? [];
  const paddingMm = paddingAlongAxis(node.paddingMm, axis);
  if (children.length === 0) {
    return MIN_SIZE_RATIO_MM + paddingMm;
  }

  if (node.type === 'grid') {
    const { rows, columns } = resolveDimensions(node.gridConfig, children.length);
    const perColumnMin = Array.from({ length: columns }, () => 0);
    const perRowMin = Array.from({ length: rows }, () => 0);

    children.forEach((child, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      perColumnMin[column] = Math.max(perColumnMin[column], computeMinRequiredMainSizeMm(child, 'w'));
      perRowMin[row] = Math.max(perRowMin[row], computeMinRequiredMainSizeMm(child, 'h'));
    });

    const columnGap = node.gridConfig?.columnGapMm ?? node.gapMm ?? 0;
    const rowGap = node.gridConfig?.rowGapMm ?? node.gapMm ?? 0;
    const minWidth =
      perColumnMin.reduce((sum, value) => sum + value, 0) +
      columnGap * Math.max(columns - 1, 0) +
      paddingMm;
    const minHeight =
      perRowMin.reduce((sum, value) => sum + value, 0) +
      rowGap * Math.max(rows - 1, 0) +
      paddingMm;

    return axis === 'w' ? minWidth : minHeight;
  }

  const nodeMainAxis: Axis = node.type === 'horizontal' ? 'w' : 'h';
  if (nodeMainAxis === axis) {
    const totalGap = (node.gapMm ?? 0) * Math.max(children.length - 1, 0);
    return children.reduce((sum, child) => sum + computeMinRequiredMainSizeMm(child, axis), totalGap) + paddingMm;
  }

  return (
    Math.max(MIN_SIZE_RATIO_MM, ...children.map((child) => computeMinRequiredMainSizeMm(child, axis))) + paddingMm
  );
}

export function resolveCrossAxis(
  align: 'left' | 'center' | 'right' | 'top' | 'bottom' | 'expand',
  crossSize: number,
  mainSize: number,
  child: LayoutNode,
  crossAxisKey: MainAxisKey,
): { crossOffset: number; crossFinalSize: number } {
  const fixedCross = child.fixedSizeMm?.[crossAxisKey];
  const aspectRatio = child.type === 'imageSlot' ? child.imageSlotConfig?.aspectRatio : undefined;
  const intrinsicFromAspect =
    aspectRatio == null
      ? undefined
      : crossAxisKey === 'heightMm'
        ? mainSize / aspectRatio
        : mainSize * aspectRatio;
  const intrinsicFromContent =
    aspectRatio == null && child.type !== 'imageSlot'
      ? computeMinRequiredMainSizeMm(child, crossAxisKey === 'heightMm' ? 'h' : 'w')
      : undefined;
  const intrinsic = fixedCross ?? intrinsicFromAspect ?? intrinsicFromContent;

  if (intrinsic == null || (align === 'expand' && fixedCross == null)) {
    return { crossOffset: 0, crossFinalSize: crossSize };
  }

  const crossFinalSize = Math.min(intrinsic, crossSize);
  const crossOffset =
    align === 'center'
      ? (crossSize - crossFinalSize) / 2
      : align === 'right' || align === 'bottom'
        ? crossSize - crossFinalSize
        : 0;

  return { crossOffset, crossFinalSize };
}

export function distributeChildren(
  rawBox: BoxMm,
  children: LayoutNode[],
  gapMm: number,
  direction: Direction,
  alignment?: AlignmentConfig,
  paddingMm?: Partial<Sides>,
): BoxMm[] {
  if (children.length === 0) {
    return [];
  }

  const box = applyPadding(rawBox, paddingMm);
  const mainAxis: Axis = direction === 'horizontal' ? 'w' : 'h';
  const mainAxisKey: MainAxisKey = direction === 'horizontal' ? 'widthMm' : 'heightMm';
  const crossAxisKey: MainAxisKey = direction === 'horizontal' ? 'heightMm' : 'widthMm';
  const totalGap = gapMm * Math.max(children.length - 1, 0);
  const fixedTotal = children.reduce((sum, child) => sum + (child.fixedSizeMm?.[mainAxisKey] ?? 0), 0);
  const flexibleChildren = children.filter((child) => child.fixedSizeMm?.[mainAxisKey] == null);
  const availableMain = Math.max(0, box[mainAxis] - totalGap - fixedTotal);
  const totalRatio = flexibleChildren.reduce((sum, child) => sum + (child.sizeRatio ?? 1), 0);
  const normalizedAlignment = normalizeAlignment(alignment);
  const crossSize = direction === 'horizontal' ? box.h : box.w;
  let cursor = direction === 'horizontal' ? box.x : box.y;

  return children.map((child) => {
    const mainSize =
      child.fixedSizeMm?.[mainAxisKey] ??
      (totalRatio === 0 ? 0 : (availableMain * (child.sizeRatio ?? 1)) / totalRatio);
    const crossAlign = direction === 'horizontal' ? normalizedAlignment.vertical : normalizedAlignment.horizontal;
    const { crossOffset, crossFinalSize } = resolveCrossAxis(
      crossAlign,
      crossSize,
      mainSize,
      child,
      crossAxisKey,
    );
    const childBox: BoxMm =
      direction === 'horizontal'
        ? { x: cursor, y: box.y + crossOffset, w: mainSize, h: crossFinalSize }
        : { x: box.x + crossOffset, y: cursor, w: crossFinalSize, h: mainSize };

    cursor += mainSize + gapMm;
    return childBox;
  });
}

export function resizeSiblingsByDrag(
  children: LayoutNode[],
  siblingIndexA: number,
  deltaMm: number,
  availableMain: number,
  mainAxisKey: MainAxisKey,
  axis: Axis,
): LayoutNode[] {
  const siblingIndexB = siblingIndexA + 1;
  if (availableMain <= 0 || isDividerLocked(children, siblingIndexA, mainAxisKey)) {
    return children;
  }

  const flexibleChildren = children.filter((child) => child.fixedSizeMm?.[mainAxisKey] == null);
  const totalRatio = flexibleChildren.reduce((sum, child) => sum + (child.sizeRatio ?? 1), 0);
  if (totalRatio <= 0) {
    return children;
  }

  const siblingA = children[siblingIndexA];
  const siblingB = children[siblingIndexB];
  if (!siblingA || !siblingB) {
    return children;
  }

  const ratioPerMm = totalRatio / availableMain;
  const currentMainA = ((siblingA.sizeRatio ?? 1) / totalRatio) * availableMain;
  const currentMainB = ((siblingB.sizeRatio ?? 1) / totalRatio) * availableMain;
  const minA = computeMinRequiredMainSizeMm(siblingA, axis);
  const minB = computeMinRequiredMainSizeMm(siblingB, axis);
  const clampedDeltaMm = clamp(deltaMm, minA - currentMainA, currentMainB - minB);
  const clampedDeltaRatio = clampedDeltaMm * ratioPerMm;

  return children.map((child, index) => {
    if (index === siblingIndexA) {
      return {
        ...child,
        sizeRatio: (siblingA.sizeRatio ?? 1) + clampedDeltaRatio,
      };
    }

    if (index === siblingIndexB) {
      return {
        ...child,
        sizeRatio: (siblingB.sizeRatio ?? 1) - clampedDeltaRatio,
      };
    }

    return child;
  });
}

