// @spec OPENSPEC.md §4.1 — computeGridCells, resolveDimensions
import type { BoxMm, GridConfig, Sides } from './types.js';

function normalizePadding(padding?: Partial<Sides>): Sides {
  return {
    top: padding?.top ?? 0,
    right: padding?.right ?? 0,
    bottom: padding?.bottom ?? 0,
    left: padding?.left ?? 0,
  };
}

function applyPaddingToBox(rawBox: BoxMm, padding?: Partial<Sides>): BoxMm {
  const normalized = normalizePadding(padding);
  return {
    x: rawBox.x + normalized.left,
    y: rawBox.y + normalized.top,
    w: Math.max(0, rawBox.w - normalized.left - normalized.right),
    h: Math.max(0, rawBox.h - normalized.top - normalized.bottom),
  };
}

export function resolveDimensions(
  gridConfig: Partial<GridConfig> | undefined,
  childrenCount: number,
  boxAspect = 1,
): { rows: number; columns: number } {
  if (!gridConfig?.autoFit) {
    return {
      rows: Math.max(1, gridConfig?.rows ?? 1),
      columns: Math.max(1, gridConfig?.columns ?? 1),
    };
  }

  if (childrenCount <= 0) {
    return { rows: 1, columns: 1 };
  }

  const safeAspect = boxAspect > 0 ? boxAspect : 1;
  const columns = Math.max(1, Math.ceil(Math.sqrt(childrenCount * safeAspect)));
  const rows = Math.max(1, Math.ceil(childrenCount / columns));
  return { rows, columns };
}

export function computeGridCells(
  rawBox: BoxMm,
  gridConfig: Partial<GridConfig> | undefined,
  childrenCount: number,
  gapMm: number,
  paddingMm?: Partial<Sides>,
): BoxMm[] {
  if (childrenCount <= 0) {
    return [];
  }

  const box = applyPaddingToBox(rawBox, paddingMm);
  const { rows, columns } = resolveDimensions(
    gridConfig,
    childrenCount,
    box.h === 0 ? 1 : box.w / box.h,
  );
  const rowGap = gridConfig?.rowGapMm ?? gapMm;
  const columnGap = gridConfig?.columnGapMm ?? gapMm;
  const safeRows = Math.max(rows, 1);
  const safeColumns = Math.max(columns, 1);
  const cellW = (box.w - columnGap * Math.max(safeColumns - 1, 0)) / safeColumns;
  const cellH = (box.h - rowGap * Math.max(safeRows - 1, 0)) / safeRows;

  return Array.from({ length: safeRows * safeColumns }, (_, index) => {
    const column = index % safeColumns;
    const row = Math.floor(index / safeColumns);

    return {
      x: box.x + column * (cellW + columnGap),
      y: box.y + row * (cellH + rowGap),
      w: cellW,
      h: cellH,
    };
  });
}

