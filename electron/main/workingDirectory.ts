import { app } from 'electron';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

let sessionId = crypto.randomUUID();
let created = false;

function currentSessionDir(): string {
  return join(app.getPath('temp'), `easy-photo-print-${sessionId}`);
}

function currentImagesDir(): string {
  return join(currentSessionDir(), 'images');
}

/** Returns the current session's working directory for image bytes, creating it (and its
 * `images` subdirectory) on first use. Every `ImageAsset.storedPath` this app ever hands the
 * renderer points somewhere under here -- see the `project-persistence` capability's "Project
 * Working Storage Is Session-Scoped, Not Persisted" requirement. */
export async function getWorkingImagesDir(): Promise<string> {
  if (!created) {
    await mkdir(currentImagesDir(), { recursive: true });
    created = true;
  }

  return currentImagesDir();
}

/** Best-effort removes the current working directory, then starts a fresh one (new session id,
 * lazily created on next `getWorkingImagesDir()` call). Used by `File > Open` (replacing the
 * whole in-memory document with a different project's images) and `File > New` (so ingested
 * images from the discarded document don't accumulate for the rest of the running session). */
export async function resetWorkingDirectory(): Promise<string> {
  await rm(currentSessionDir(), { recursive: true, force: true }).catch(() => {
    // Best-effort -- a working directory the OS already reclaimed, or one we never created, isn't
    // worth failing an Open/New over.
  });

  sessionId = crypto.randomUUID();
  created = false;
  return getWorkingImagesDir();
}

/** Best-effort removes the current working directory without starting a new one -- the app is
 * exiting, so there's nothing left to create one for. */
export async function cleanupWorkingDirectoryOnQuit(): Promise<void> {
  await rm(currentSessionDir(), { recursive: true, force: true }).catch(() => {
    // Best-effort -- see resetWorkingDirectory.
  });
}
