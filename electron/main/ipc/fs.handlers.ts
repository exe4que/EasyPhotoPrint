import { dialog, ipcMain, nativeImage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

import type { EPPProject, ImageAsset } from '@epp/layout-engine';

import { applyRegeneratedImage, normalizeProjectDocument, prepareProjectForSave, type PersistedImageAsset } from './fs.helpers.js';

const OPEN_IMAGES_CHANNEL = 'dialog:open-images';
const RELINK_IMAGE_CHANNEL = 'dialog:relink-image';
const OPEN_PROJECT_CHANNEL = 'fs:open-project';
const SAVE_PROJECT_CHANNEL = 'fs:save-project';
const MAX_THUMBNAIL_EDGE_PX = 240;
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'];

const MISSING_IMAGE_PLACEHOLDER_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">' +
    '<rect width="240" height="240" fill="#1e293b"/>' +
    '<path d="M60 60 L180 180 M180 60 L60 180" stroke="#f87171" stroke-width="10" stroke-linecap="round"/>' +
    '</svg>',
)}`;

interface SaveProjectOptions {
  /** The project's currently remembered file path, if any (null for a never-saved project). */
  existingPath: string | null;
  /** True for "Save As", which always prompts even when existingPath is set. */
  forceDialog: boolean;
}

function computeThumbnailSize(widthPx: number, heightPx: number): { width: number; height: number } {
  if (widthPx <= 0 || heightPx <= 0) {
    throw new Error('Image dimensions must be positive.');
  }

  const scale = Math.min(1, MAX_THUMBNAIL_EDGE_PX / Math.max(widthPx, heightPx));
  return {
    width: Math.max(1, Math.round(widthPx * scale)),
    height: Math.max(1, Math.round(heightPx * scale)),
  };
}

function decodeAndThumbnail(filePath: string): { widthPx: number; heightPx: number; thumbnailDataUrl: string } {
  const image = nativeImage.createFromPath(filePath);
  const size = image.getSize();
  if (size.width <= 0 || size.height <= 0) {
    throw new Error(`Could not decode image metadata for ${filePath}.`);
  }

  const thumbnailSize = computeThumbnailSize(size.width, size.height);
  const thumbnail = image.resize({
    width: thumbnailSize.width,
    height: thumbnailSize.height,
    quality: 'good',
  });

  return { widthPx: size.width, heightPx: size.height, thumbnailDataUrl: thumbnail.toDataURL() };
}

function createImageAssetFromPath(filePath: string): ImageAsset {
  const { widthPx, heightPx, thumbnailDataUrl } = decodeAndThumbnail(filePath);
  return {
    id: crypto.randomUUID(),
    originalPath: filePath,
    storedPath: filePath,
    fileName: basename(filePath),
    widthPx,
    heightPx,
    thumbnailDataUrl,
  };
}

/** Regenerates a persisted ImageAsset's thumbnail from its saved originalPath. If the file can no
 * longer be read/decoded, the entry is kept (with its persisted widthPx/heightPx, since those don't
 * require the file to exist) and flagged missing instead of failing the whole project load. */
function regenerateImageAsset(persisted: PersistedImageAsset): ImageAsset {
  try {
    return applyRegeneratedImage(persisted, decodeAndThumbnail(persisted.originalPath), MISSING_IMAGE_PLACEHOLDER_DATA_URL);
  } catch {
    return applyRegeneratedImage(persisted, null, MISSING_IMAGE_PLACEHOLDER_DATA_URL);
  }
}

export function registerFsHandlers(): void {
  ipcMain.removeHandler(OPEN_IMAGES_CHANNEL);
  ipcMain.removeHandler(RELINK_IMAGE_CHANNEL);
  ipcMain.removeHandler(OPEN_PROJECT_CHANNEL);
  ipcMain.removeHandler(SAVE_PROJECT_CHANNEL);

  ipcMain.handle(OPEN_IMAGES_CHANNEL, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select images',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
    });

    return result.canceled ? [] : result.filePaths.map(createImageAssetFromPath);
  });

  ipcMain.handle(RELINK_IMAGE_CHANNEL, async (): Promise<Omit<ImageAsset, 'id'> | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Locate image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    // id is intentionally omitted: the renderer already knows which existing ImageAsset this
    // relink applies to and keeps that asset's id -- Main's freshly-minted id here is unused.
    const { id: _id, ...asset } = createImageAssetFromPath(filePath);
    return asset;
  });

  ipcMain.handle(OPEN_PROJECT_CHANNEL, async (): Promise<{ project: EPPProject; filePath: string } | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Open project',
      properties: ['openFile'],
      filters: [{ name: 'Easy Photo Print Project', extensions: ['eppproj'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const raw = await readFile(filePath, 'utf8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`"${basename(filePath)}" is not a valid project file (invalid JSON).`);
    }

    const { project, imagePool } = normalizeProjectDocument(parsed);
    return {
      project: { ...project, imagePool: imagePool.map(regenerateImageAsset) },
      filePath,
    };
  });

  ipcMain.handle(SAVE_PROJECT_CHANNEL, async (_event, project: EPPProject, options: SaveProjectOptions): Promise<string | null> => {
    let targetPath = options.existingPath;

    if (options.forceDialog || !targetPath) {
      const result = await dialog.showSaveDialog({
        title: 'Save project',
        defaultPath: targetPath ?? `${project.name || 'Untitled'}.eppproj`,
        filters: [{ name: 'Easy Photo Print Project', extensions: ['eppproj'] }],
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      targetPath = result.filePath;
    }

    await writeFile(targetPath, JSON.stringify(prepareProjectForSave(project), null, 2), 'utf8');
    return targetPath;
  });
}
