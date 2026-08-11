import { Preferences } from '@capacitor/preferences';
import { unzipSync, zipSync } from 'fflate';

import type { EPPProject, EPPTemplate, ImageAsset } from '@epp/layout-engine';

import {
  applyRegeneratedImage,
  normalizeProjectDocument,
  prepareProjectForSave,
  type PersistedImageAsset,
} from '../../../electron/main/ipc/fs.helpers.js';
import { normalizeTemplateDocument, prepareTemplateForSave } from '../../../electron/main/ipc/templates.helpers.js';
import { composeProjectPdf } from '../android/composeProjectPdf.js';
import { decodeImageFromBlob } from '../android/imageDecode.js';
import { Print } from '../android/printPlugin.js';
import { SafFile, type SafFile as SafFileEntry } from '../android/safFilePlugin.js';
import { computeCoverDecodeSize, computeThumbnailSize } from '../android/thumbnailSize.js';
import { workingStorage } from '../android/workingStorage.js';
import type { AppSettings, EppAPI } from './contract.js';

const SETTINGS_KEY = 'epp-settings';
const DEFAULT_SETTINGS: AppSettings = {
  unitSystem: 'metric',
};

const PROJECT_JSON_ENTRY = 'project.json';
const EPPPROJ_MIME_TYPES = ['application/octet-stream', 'application/zip'];
const IMAGE_MIME_TYPES = ['image/*'];

const TEMPLATES_INDEX_KEY = 'epp-templates-index';
const templateKey = (id: string) => `epp-template-${id}`;

const MISSING_IMAGE_PLACEHOLDER_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">' +
    '<rect width="240" height="240" fill="#1e293b"/>' +
    '<path d="M60 60 L180 180 M180 60 L60 180" stroke="#f87171" stroke-width="10" stroke-linecap="round"/>' +
    '</svg>',
)}`;

function extnameOf(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.slice(dotIndex) : '';
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

// --- Settings (Preferences-backed) -----------------------------------------------------------

async function readSettings(): Promise<AppSettings> {
  const { value } = await Preferences.get({ key: SETTINGS_KEY });
  if (value == null) {
    return DEFAULT_SETTINGS;
  }

  const parsed = JSON.parse(value) as Partial<AppSettings>;
  return {
    unitSystem: parsed.unitSystem === 'imperial' ? 'imperial' : 'metric',
    defaultPrinterName: parsed.defaultPrinterName,
  };
}

async function writeSettings(settings: AppSettings): Promise<AppSettings> {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) });
  return settings;
}

// --- Image ingest (SAF picker + IndexedDB working storage + in-WebView decode) ---------------

async function decodeAndThumbnail(blob: Blob): Promise<{ widthPx: number; heightPx: number; thumbnailDataUrl: string }> {
  const image = await decodeImageFromBlob(blob);
  const size = image.getSize();
  if (size.width <= 0 || size.height <= 0) {
    throw new Error('Could not decode image metadata.');
  }

  const thumbnailSize = computeThumbnailSize(size.width, size.height);
  const thumbnail = image.resize(thumbnailSize);
  return { widthPx: size.width, heightPx: size.height, thumbnailDataUrl: await thumbnail.toDataURL() };
}

/** Stores a picked file's bytes in IndexedDB working storage under a fresh assetId, decodes and
 * thumbnails it -- the Android counterpart to `fs.handlers.ts`'s `createImageAssetFromPath`. */
async function createImageAssetFromSafFile(file: SafFileEntry): Promise<ImageAsset> {
  const id = crypto.randomUUID();
  const blob = new Blob([base64ToBytes(file.base64).slice()]);
  await workingStorage.put(id, blob);
  const { widthPx, heightPx, thumbnailDataUrl } = await decodeAndThumbnail(blob);
  return {
    id,
    originalPath: file.fileName,
    storedPath: id,
    fileName: file.fileName,
    widthPx,
    heightPx,
    thumbnailDataUrl,
  };
}

/** Regenerates a persisted ImageAsset's thumbnail from its bundled zip entry, storing its bytes
 * back into IndexedDB working storage under its persisted id. Mirrors `fs.handlers.ts`'s
 * `regenerateImageAsset`: a missing/corrupted entry flags the asset missing rather than failing
 * the whole project load. */
async function regenerateImageAsset(persisted: PersistedImageAsset, bundleFiles: Record<string, Uint8Array>): Promise<ImageAsset> {
  const entryBytes = bundleFiles[`images/${persisted.id}${extnameOf(persisted.fileName)}`];

  let regenerated: { widthPx: number; heightPx: number; thumbnailDataUrl: string } | null = null;
  if (entryBytes) {
    try {
      const blob = new Blob([entryBytes.slice()]);
      await workingStorage.put(persisted.id, blob);
      regenerated = await decodeAndThumbnail(blob);
    } catch {
      regenerated = null;
    }
  }

  return { ...applyRegeneratedImage(persisted, regenerated, MISSING_IMAGE_PLACEHOLDER_DATA_URL), storedPath: persisted.id };
}

// --- Templates (Preferences-backed) -----------------------------------------------------------

async function readTemplatesIndex(): Promise<string[]> {
  const { value } = await Preferences.get({ key: TEMPLATES_INDEX_KEY });
  return value ? (JSON.parse(value) as string[]) : [];
}

async function writeTemplatesIndex(ids: string[]): Promise<void> {
  await Preferences.set({ key: TEMPLATES_INDEX_KEY, value: JSON.stringify(ids) });
}

/** The Android host's adapter, registered by `src/main.android.tsx` before first render. Settings
 * and templates are backed by `@capacitor/preferences` (SharedPreferences); file access goes
 * through the `SafFile` Capacitor plugin (Storage Access Framework); image decode, thumbnailing,
 * and PDF composition run entirely in the WebView; printing goes through the `Print` Capacitor
 * plugin. See design.md for the full rationale. */
export function createAndroidAdapter(): EppAPI {
  return {
    dialog: {
      openImages: async () => {
        const { files } = await SafFile.openImages();
        return Promise.all(files.map(createImageAssetFromSafFile));
      },
      relinkImage: async () => {
        const { file } = await SafFile.openDocument({ mimeTypes: IMAGE_MIME_TYPES });
        if (file == null) {
          return null;
        }

        const { id: _id, ...rest } = await createImageAssetFromSafFile(file);
        return rest;
      },
    },
    fs: {
      openProject: async () => {
        const { file } = await SafFile.openDocument({ mimeTypes: EPPPROJ_MIME_TYPES });
        if (file == null) {
          return null;
        }

        let bundleFiles: Record<string, Uint8Array>;
        try {
          bundleFiles = unzipSync(base64ToBytes(file.base64));
        } catch {
          throw new Error(`"${file.fileName}" is not a valid Easy Photo Print project (the archive is corrupted or not a zip file).`);
        }

        const projectJsonBytes = bundleFiles[PROJECT_JSON_ENTRY];
        if (!projectJsonBytes) {
          throw new Error(`"${file.fileName}" is not a valid Easy Photo Print project (missing project.json).`);
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(new TextDecoder().decode(projectJsonBytes));
        } catch {
          throw new Error(`"${file.fileName}" is not a valid Easy Photo Print project (project.json is not valid JSON).`);
        }

        await workingStorage.clear();
        const { project, imagePool } = normalizeProjectDocument(parsed);
        const regeneratedPool = await Promise.all(imagePool.map((asset) => regenerateImageAsset(asset, bundleFiles)));
        return { project: { ...project, imagePool: regeneratedPool }, filePath: file.uri };
      },
      saveProject: async (project: EPPProject, options) => {
        const imageEntries: Record<string, Uint8Array> = {};
        for (const asset of project.imagePool) {
          const blob = await workingStorage.get(asset.storedPath);
          if (blob == null) {
            throw new Error(`Could not save the project: "${asset.fileName}" is no longer available in working storage.`);
          }
          imageEntries[`images/${asset.id}${extnameOf(asset.fileName)}`] = new Uint8Array(await blob.arrayBuffer());
        }

        const zipBytes = zipSync({
          [PROJECT_JSON_ENTRY]: new TextEncoder().encode(JSON.stringify(prepareProjectForSave(project))),
          ...imageEntries,
        });
        const base64 = bytesToBase64(zipBytes);

        if (options.forceDialog || !options.existingPath) {
          const { uri } = await SafFile.createDocument({
            fileName: `${project.name || 'Untitled'}.eppproj`,
            mimeType: 'application/octet-stream',
            base64,
          });
          return uri;
        }

        await SafFile.writeDocument({ uri: options.existingPath, base64 });
        return options.existingPath;
      },
      resetWorkingStorage: async () => {
        await workingStorage.clear();
      },
    },
    images: {
      decodeAtSize: async (filePath, minWidthPx, minHeightPx) => {
        const blob = await workingStorage.get(filePath);
        if (blob == null) {
          throw new Error(`Could not decode image metadata for ${filePath}.`);
        }

        const image = await decodeImageFromBlob(blob);
        const size = image.getSize();
        if (size.width <= 0 || size.height <= 0) {
          throw new Error(`Could not decode image metadata for ${filePath}.`);
        }

        const targetSize = computeCoverDecodeSize(size.width, size.height, minWidthPx, minHeightPx);
        return image.resize(targetSize).toDataURL();
      },
    },
    pdf: {
      export: async (project) => {
        const pdfBytes = await composeProjectPdf(project);
        const { uri } = await SafFile.createDocument({
          fileName: `${project.name || 'Untitled'}.pdf`,
          mimeType: 'application/pdf',
          base64: bytesToBase64(pdfBytes),
        });
        return uri;
      },
    },
    print: {
      document: async (project) => {
        const pdfBytes = await composeProjectPdf(project);
        await Print.printPdf({ base64: bytesToBase64(pdfBytes), jobName: project.name || 'Document' });
      },
    },
    settings: {
      get: readSettings,
      set: async (patch) => {
        const current = await readSettings();
        const next: AppSettings = {
          unitSystem: patch.unitSystem ?? current.unitSystem,
          defaultPrinterName: patch.defaultPrinterName === undefined ? current.defaultPrinterName : patch.defaultPrinterName,
        };
        return writeSettings(next);
      },
    },
    templates: {
      list: async () => {
        const ids = await readTemplatesIndex();
        const templates = await Promise.all(
          ids.map(async (id) => {
            const { value } = await Preferences.get({ key: templateKey(id) });
            return value ? normalizeTemplateDocument(JSON.parse(value)) : null;
          }),
        );

        return (templates.filter((template): template is EPPTemplate => template != null) as EPPTemplate[]).sort((left, right) => {
          const leftDate = left.updatedAt ?? left.createdAt ?? '';
          const rightDate = right.updatedAt ?? right.createdAt ?? '';
          return rightDate.localeCompare(leftDate);
        });
      },
      save: async (template) => {
        if (template.name.trim() === '') {
          throw new Error('Template name cannot be empty.');
        }

        const { value } = await Preferences.get({ key: templateKey(template.id) });
        const existing = value ? normalizeTemplateDocument(JSON.parse(value)) : undefined;
        const nextTemplate = prepareTemplateForSave(template, existing);

        await Preferences.set({ key: templateKey(nextTemplate.id), value: JSON.stringify(nextTemplate) });
        const ids = await readTemplatesIndex();
        if (!ids.includes(nextTemplate.id)) {
          await writeTemplatesIndex([...ids, nextTemplate.id]);
        }

        return nextTemplate;
      },
      delete: async (templateId) => {
        await Preferences.remove({ key: templateKey(templateId) });
        const ids = await readTemplatesIndex();
        await writeTemplatesIndex(ids.filter((id) => id !== templateId));
      },
    },
  };
}
