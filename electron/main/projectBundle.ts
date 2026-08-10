import { zipSync, unzipSync } from 'fflate';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const PROJECT_JSON_ENTRY = 'project.json';

export interface BundleImageSource {
  assetId: string;
  ext: string;
  /** Where to read this image's current bytes from -- an `ImageAsset.storedPath`. */
  filePath: string;
}

/** Builds a `.eppproj` archive: `project.json` plus one `images/<assetId><ext>` entry per image,
 * holding that asset's current bytes. Reading a `storedPath` that no longer exists surfaces as a
 * rejected promise -- the caller (the `fs:save-project` handler) is responsible for turning that
 * into a user-facing save error, per the "Saved Project Files Are Self-Contained Bundles"
 * requirement's atomicity guarantee (nothing is written to the target path in that case). */
export async function buildProjectBundle(projectJson: unknown, images: BundleImageSource[]): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {
    [PROJECT_JSON_ENTRY]: new TextEncoder().encode(JSON.stringify(projectJson)),
  };

  for (const image of images) {
    const bytes = await readFile(image.filePath);
    files[`images/${image.assetId}${image.ext}`] = new Uint8Array(bytes);
  }

  return zipSync(files);
}

/** Extracts a `.eppproj` archive: parses and returns its `project.json` entry, and best-effort
 * writes every `images/*` entry to `destImagesDir`. Throws only when `project.json` itself is
 * missing or unparseable -- the "invalid or unreadable file" whole-open failure. A corrupted or
 * missing individual image entry is *not* treated as a whole-open failure: it's silently skipped
 * here, and surfaces later as that one asset's `missing: true` when the caller tries to decode a
 * file that never got extracted (the same catch-based path `regenerateImageAsset` already uses),
 * per "Missing Image Detection on Project Open". */
export async function extractProjectBundle(zipBytes: Uint8Array, destImagesDir: string): Promise<unknown> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipBytes);
  } catch {
    throw new Error('Not a valid Easy Photo Print project (the archive is corrupted or not a zip file).');
  }

  const projectJsonBytes = files[PROJECT_JSON_ENTRY];
  if (!projectJsonBytes) {
    throw new Error('Not a valid Easy Photo Print project (missing project.json).');
  }

  let projectJson: unknown;
  try {
    projectJson = JSON.parse(new TextDecoder().decode(projectJsonBytes));
  } catch {
    throw new Error('Not a valid Easy Photo Print project (project.json is not valid JSON).');
  }

  await Promise.all(
    Object.entries(files)
      .filter(([path]) => path.startsWith('images/') && path !== 'images/')
      .map(([path, bytes]) =>
        writeFile(join(destImagesDir, basename(path)), bytes).catch(() => {
          // Best-effort -- see this function's doc comment. A file that fails to write here just
          // never exists at the path Main will later try to decode from.
        }),
      ),
  );

  return projectJson;
}
