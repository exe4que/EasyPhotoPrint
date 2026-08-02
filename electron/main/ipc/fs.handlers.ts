// @spec OPENSPEC.md §2.2, §3.3 — explicit IPC for file and dialog access
import { dialog, ipcMain, nativeImage } from 'electron';
import { basename } from 'node:path';

import type { EPPProject, ImageAsset } from '@epp/layout-engine';

const OPEN_IMAGES_CHANNEL = 'dialog:open-images';
const OPEN_PROJECT_CHANNEL = 'fs:open-project';
const SAVE_PROJECT_CHANNEL = 'fs:save-project';
const MAX_THUMBNAIL_EDGE_PX = 240;

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

function createImageAssetFromPath(filePath: string): ImageAsset {
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

  return {
    id: crypto.randomUUID(),
    originalPath: filePath,
    storedPath: filePath,
    fileName: basename(filePath),
    widthPx: size.width,
    heightPx: size.height,
    thumbnailDataUrl: thumbnail.toDataURL(),
  };
}

export function registerFsHandlers(): void {
  ipcMain.removeHandler(OPEN_IMAGES_CHANNEL);
  ipcMain.removeHandler(OPEN_PROJECT_CHANNEL);
  ipcMain.removeHandler(SAVE_PROJECT_CHANNEL);

  ipcMain.handle(OPEN_IMAGES_CHANNEL, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select images',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'],
        },
      ],
    });

    return result.canceled ? [] : result.filePaths.map(createImageAssetFromPath);
  });

  ipcMain.handle(OPEN_PROJECT_CHANNEL, async () => {
    throw new Error('Opening .eppproj files is not implemented yet.');
  });

  ipcMain.handle(SAVE_PROJECT_CHANNEL, async (_event, _project: EPPProject) => {
    throw new Error('Saving .eppproj files is not implemented yet.');
  });
}
