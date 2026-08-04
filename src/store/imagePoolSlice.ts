import type { ImageAsset } from '@epp/layout-engine';

import { getEppApi } from '../lib/ipc-client.js';

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read file ${file.name}.`));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error(`FileReader did not produce a data URL for ${file.name}.`));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

async function measureImage(dataUrl: string): Promise<{ widthPx: number; heightPx: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('Could not decode image dimensions.'));
    image.onload = () => {
      resolve({ widthPx: image.naturalWidth, heightPx: image.naturalHeight });
    };
    image.src = dataUrl;
  });
}

export interface ImagePoolSlice {
  imagePool: ImageAsset[];
  loadImages: (files: File[]) => Promise<void>;
  openImagesFromDialog: () => Promise<void>;
}

export function createImagePoolSlice(
  set: (
    updater: (state: { imagePool: ImageAsset[] }) => Partial<{ imagePool: ImageAsset[] }>,
  ) => void,
): ImagePoolSlice {
  const mergeAssets = (currentAssets: ImageAsset[], nextAssets: ImageAsset[]) => [...currentAssets, ...nextAssets];

  return {
    imagePool: [],
    loadImages: async (files) => {
      const assets = await Promise.all(
        files.map(async (file) => {
          const thumbnailDataUrl = await readFileAsDataUrl(file);
          const { widthPx, heightPx } = await measureImage(thumbnailDataUrl);
          const fileWithPath = file as File & { path?: string };
          const sourcePath = fileWithPath.path ?? file.name;

          return {
            id: crypto.randomUUID(),
            originalPath: sourcePath,
            storedPath: sourcePath,
            fileName: file.name,
            widthPx,
            heightPx,
            thumbnailDataUrl,
          } satisfies ImageAsset;
        }),
      );

      set((state) => ({ imagePool: mergeAssets(state.imagePool, assets) }));
    },
    openImagesFromDialog: async () => {
      const assets = await getEppApi().dialog.openImages();
      set((state) => ({ imagePool: mergeAssets(state.imagePool, assets) }));
    },
  };
}
