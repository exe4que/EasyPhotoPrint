import { dialog, ipcMain, nativeImage } from 'electron';
import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import type { EPPProject, ImageAsset } from '@epp/layout-engine';

import { buildProjectBundle, extractProjectBundle, type BundleImageSource } from '../projectBundle.js';
import { getWorkingImagesDir, resetWorkingDirectory } from '../workingDirectory.js';
import {
  applyRegeneratedImage,
  computeCoverDecodeSize,
  normalizeProjectDocument,
  prepareProjectForSave,
  type PersistedImageAsset,
} from './fs.helpers.js';

const OPEN_IMAGES_CHANNEL = 'dialog:open-images';
const RELINK_IMAGE_CHANNEL = 'dialog:relink-image';
const OPEN_PROJECT_CHANNEL = 'fs:open-project';
const SAVE_PROJECT_CHANNEL = 'fs:save-project';
const RESET_WORKING_STORAGE_CHANNEL = 'fs:reset-working-storage';
const DECODE_IMAGE_AT_SIZE_CHANNEL = 'images:decode-at-size';
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

/** Decodes filePath at (up to) native resolution, only as small as still covers the requested
 * minimum size in both dimensions -- see computeCoverDecodeSize. Used for print-preview, where
 * the bounded-edge thumbnailDataUrl every ImageAsset already carries isn't enough resolution. */
function decodeImageAtSize(filePath: string, minWidthPx: number, minHeightPx: number): string {
  const image = nativeImage.createFromPath(filePath);
  const size = image.getSize();
  if (size.width <= 0 || size.height <= 0) {
    throw new Error(`Could not decode image metadata for ${filePath}.`);
  }

  const targetSize = computeCoverDecodeSize(size.width, size.height, minWidthPx, minHeightPx);
  return image.resize({ width: targetSize.width, height: targetSize.height, quality: 'good' }).toDataURL();
}

/** Copies `sourcePath`'s bytes into the current session's working directory, named by `assetId`
 * plus `sourcePath`'s own extension -- see the `project-persistence` capability's "Project
 * Working Storage Is Session-Scoped, Not Persisted" requirement. */
async function copyIntoWorkingDir(sourcePath: string, assetId: string): Promise<string> {
  const imagesDir = await getWorkingImagesDir();
  const destPath = join(imagesDir, `${assetId}${extname(sourcePath)}`);
  await copyFile(sourcePath, destPath);
  return destPath;
}

/** Ingests a picked file: copies it into the working directory first, then decodes/thumbnails
 * from that copy (not the original) -- so `storedPath` is always a working-directory file from
 * the instant an asset exists, per "Native Image Ingestion Dialog". Shared by the open-images and
 * relink-image handlers below. */
async function createImageAssetFromPath(filePath: string): Promise<ImageAsset> {
  const id = crypto.randomUUID();
  const storedPath = await copyIntoWorkingDir(filePath, id);
  const { widthPx, heightPx, thumbnailDataUrl } = decodeAndThumbnail(storedPath);
  return {
    id,
    originalPath: filePath,
    storedPath,
    fileName: basename(filePath),
    widthPx,
    heightPx,
    thumbnailDataUrl,
  };
}

/** Regenerates a persisted ImageAsset's thumbnail from its just-extracted working-directory copy.
 * If that copy can't be read/decoded (a corrupted or missing bundle entry), the entry is kept
 * (with its persisted widthPx/heightPx, since those don't require the bytes to be readable) and
 * flagged missing instead of failing the whole project load. */
function regenerateImageAsset(persisted: PersistedImageAsset, imagesDir: string): ImageAsset {
  const extractedPath = join(imagesDir, `${persisted.id}${extname(persisted.fileName)}`);

  let regenerated: { widthPx: number; heightPx: number; thumbnailDataUrl: string } | null;
  try {
    regenerated = decodeAndThumbnail(extractedPath);
  } catch {
    regenerated = null;
  }

  return { ...applyRegeneratedImage(persisted, regenerated, MISSING_IMAGE_PLACEHOLDER_DATA_URL), storedPath: extractedPath };
}

export function registerFsHandlers(): void {
  ipcMain.removeHandler(OPEN_IMAGES_CHANNEL);
  ipcMain.removeHandler(RELINK_IMAGE_CHANNEL);
  ipcMain.removeHandler(OPEN_PROJECT_CHANNEL);
  ipcMain.removeHandler(SAVE_PROJECT_CHANNEL);
  ipcMain.removeHandler(RESET_WORKING_STORAGE_CHANNEL);
  ipcMain.removeHandler(DECODE_IMAGE_AT_SIZE_CHANNEL);

  ipcMain.handle(OPEN_IMAGES_CHANNEL, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select images',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
    });

    return result.canceled ? [] : Promise.all(result.filePaths.map(createImageAssetFromPath));
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
    const { id: _id, ...asset } = await createImageAssetFromPath(filePath);
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
    const zipBytes = await readFile(filePath);
    const imagesDir = await resetWorkingDirectory();

    let parsed: unknown;
    try {
      parsed = await extractProjectBundle(zipBytes, imagesDir);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`"${basename(filePath)}" is not a valid Easy Photo Print project: ${reason}`);
    }

    const { project, imagePool } = normalizeProjectDocument(parsed);
    return {
      project: { ...project, imagePool: imagePool.map((asset) => regenerateImageAsset(asset, imagesDir)) },
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

    const images: BundleImageSource[] = project.imagePool.map((asset) => ({
      assetId: asset.id,
      ext: extname(asset.fileName),
      filePath: asset.storedPath,
    }));

    let bundleBytes: Uint8Array;
    try {
      bundleBytes = await buildProjectBundle(prepareProjectForSave(project), images);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not save the project: ${reason}`);
    }

    // Write to a temp file in the same directory (same volume, so the rename is atomic) and
    // rename over the target -- a failed write can't corrupt a previously saved file.
    const tempPath = `${targetPath}.tmp-${crypto.randomUUID()}`;
    try {
      await writeFile(tempPath, bundleBytes);
      await rename(tempPath, targetPath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }

    return targetPath;
  });

  ipcMain.handle(RESET_WORKING_STORAGE_CHANNEL, async (): Promise<void> => {
    await resetWorkingDirectory();
  });

  ipcMain.handle(
    DECODE_IMAGE_AT_SIZE_CHANNEL,
    async (_event, filePath: string, minWidthPx: number, minHeightPx: number): Promise<string> =>
      decodeImageAtSize(filePath, minWidthPx, minHeightPx),
  );
}
