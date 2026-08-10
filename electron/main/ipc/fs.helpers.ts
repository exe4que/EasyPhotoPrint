import type { EPPProject, EPPProjectPage, ImageAsset, ProjectPageConfig, SheetSize } from '@epp/layout-engine';
import { migrateProject } from '@epp/migrations';

import { assertLayoutNode } from './templates.helpers.js';

/** An ImageAsset as persisted on disk -- never carries thumbnailDataUrl or missing (both are derived at load time, not saved). */
export type PersistedImageAsset = Omit<ImageAsset, 'thumbnailDataUrl' | 'missing'>;

/** A project page's own config -- orientation/dpi only. Sheet size lives solely on the
 * document-level `sheetSize` (see assertSheetSize below), never per page. */
function assertProjectPageConfig(value: Record<string, unknown>): ProjectPageConfig {
  const orientation = value.orientation;
  const dpi = value.dpi;

  if ((orientation !== 'portrait' && orientation !== 'landscape') || typeof dpi !== 'number') {
    throw new Error('Project page config is invalid.');
  }

  return { orientation, dpi };
}

function assertSheetSize(value: Record<string, unknown>): SheetSize {
  const sizePreset = value.sizePreset;

  if (
    sizePreset !== 'A4' &&
    sizePreset !== 'Letter' &&
    sizePreset !== 'Legal' &&
    sizePreset !== '4x6' &&
    sizePreset !== '5x7' &&
    sizePreset !== 'A3' &&
    sizePreset !== 'Custom'
  ) {
    throw new Error('Project sheet size is invalid.');
  }

  const customSizeRaw = value.customSizeMm as Record<string, unknown> | undefined;
  const customSizeMm =
    typeof customSizeRaw === 'object' &&
    customSizeRaw != null &&
    !Array.isArray(customSizeRaw) &&
    typeof customSizeRaw.widthMm === 'number' &&
    typeof customSizeRaw.heightMm === 'number'
      ? { widthMm: customSizeRaw.widthMm, heightMm: customSizeRaw.heightMm }
      : undefined;

  return { sizePreset, customSizeMm };
}

function assertProjectPage(value: Record<string, unknown>): EPPProjectPage {
  const id = value.id;
  const assignments = value.assignments;
  const pageConfigRaw = value.pageConfig;
  const rootNodeRaw = value.rootNode;

  if (typeof id !== 'string') {
    throw new Error('Project page is missing a valid id.');
  }
  if (typeof assignments !== 'object' || assignments == null || Array.isArray(assignments)) {
    throw new Error('Project page is missing a valid assignments map.');
  }
  if (typeof pageConfigRaw !== 'object' || pageConfigRaw == null || Array.isArray(pageConfigRaw)) {
    throw new Error('Project page is missing a valid pageConfig.');
  }
  if (typeof rootNodeRaw !== 'object' || rootNodeRaw == null || Array.isArray(rootNodeRaw)) {
    throw new Error('Project page is missing a valid rootNode.');
  }

  return {
    id,
    pageConfig: assertProjectPageConfig(pageConfigRaw as Record<string, unknown>),
    templateRef: typeof value.templateRef === 'string' ? value.templateRef : undefined,
    rootNode: assertLayoutNode(rootNodeRaw as Record<string, unknown>),
    assignments: assignments as Record<string, string>,
  };
}

function assertPersistedImageAsset(value: Record<string, unknown>): PersistedImageAsset {
  const { id, originalPath, storedPath, fileName, widthPx, heightPx, dpiOriginal } = value;

  if (
    typeof id !== 'string' ||
    typeof originalPath !== 'string' ||
    typeof storedPath !== 'string' ||
    typeof fileName !== 'string' ||
    typeof widthPx !== 'number' ||
    typeof heightPx !== 'number'
  ) {
    throw new Error('Project image pool entry is invalid.');
  }

  return {
    id,
    originalPath,
    storedPath,
    fileName,
    widthPx,
    heightPx,
    dpiOriginal: typeof dpiOriginal === 'number' ? dpiOriginal : undefined,
  };
}

/** Validates a raw parsed .eppproj document at a structural level, same depth as normalizeTemplateDocument. */
export function normalizeProjectDocument(raw: unknown): {
  project: Omit<EPPProject, 'imagePool'>;
  imagePool: PersistedImageAsset[];
} {
  const migrated = migrateProject(raw);

  return {
    project: {
      schemaVersion: migrated.schemaVersion,
      id: migrated.id,
      name: migrated.name,
      sheetSize: assertSheetSize(migrated.sheetSize),
      pages: migrated.pages.map(assertProjectPage),
    },
    imagePool: migrated.imagePool.map(assertPersistedImageAsset),
  };
}

/** Merges a successfully re-decoded thumbnail into a persisted asset, or -- when decoding failed
 * (regenerated is null) -- flags the asset missing and gives it a placeholder thumbnail instead,
 * keeping its persisted widthPx/heightPx/fileName/originalPath as-is. Pure and decode-mechanism-agnostic
 * so it's testable without a real Electron nativeImage call. */
export function applyRegeneratedImage(
  persisted: PersistedImageAsset,
  regenerated: { widthPx: number; heightPx: number; thumbnailDataUrl: string } | null,
  missingPlaceholderDataUrl: string,
): ImageAsset {
  if (regenerated) {
    return { ...persisted, ...regenerated };
  }

  return { ...persisted, thumbnailDataUrl: missingPlaceholderDataUrl, missing: true };
}

/** Strips fields that are never persisted (thumbnailDataUrl, missing) before writing a project to disk. */
export function prepareProjectForSave(project: EPPProject): unknown {
  return {
    schemaVersion: project.schemaVersion,
    id: project.id,
    name: project.name,
    sheetSize: project.sheetSize,
    pages: project.pages,
    imagePool: project.imagePool.map(({ thumbnailDataUrl: _thumbnailDataUrl, missing: _missing, ...persisted }) => persisted),
  };
}

/** The smallest size, preserving the source's own aspect ratio, whose width and height are both
 * at least (minWidthPx, minHeightPx) -- the inverse of a "fit under a max edge" thumbnail size:
 * this finds the smallest size that still *covers* a minimum in both axes, never upscaling past
 * the source's native resolution. */
export function computeCoverDecodeSize(
  nativeWidthPx: number,
  nativeHeightPx: number,
  minWidthPx: number,
  minHeightPx: number,
): { width: number; height: number } {
  if (nativeWidthPx <= 0 || nativeHeightPx <= 0) {
    throw new Error('Native image dimensions must be positive.');
  }

  const scale = Math.min(1, Math.max(minWidthPx / nativeWidthPx, minHeightPx / nativeHeightPx));
  return {
    width: Math.max(1, Math.round(nativeWidthPx * scale)),
    height: Math.max(1, Math.round(nativeHeightPx * scale)),
  };
}
