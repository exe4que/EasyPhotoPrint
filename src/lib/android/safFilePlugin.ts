import { registerPlugin } from '@capacitor/core';

export interface SafFile {
  uri: string;
  fileName: string;
  /** Base64-encoded file bytes (no data: URL prefix). */
  base64: string;
}

export interface SafFilePlugin {
  /** Opens the native document picker (multi-select, image MIME types) and reads every picked
   * file's bytes. Returns an empty list if the user cancels. */
  openImages(): Promise<{ files: SafFile[] }>;
  /** Opens the native document picker (single-select), optionally filtered to `mimeTypes`, and
   * reads the picked file's bytes. `file` is `null` if the user cancels. */
  openDocument(options: { mimeTypes?: string[] }): Promise<{ file: SafFile | null }>;
  /** Opens the native "create document" picker for `fileName`/`mimeType` and writes `base64` to
   * it. `uri` is `null` if the user cancels. */
  createDocument(options: { fileName: string; mimeType: string; base64: string }): Promise<{ uri: string | null }>;
  /** Writes `base64` to an already-known `content://` URI, without prompting. */
  writeDocument(options: { uri: string; base64: string }): Promise<void>;
}

/** The Android counterpart to Electron's native file dialogs -- see
 * openspec/changes/android-shell/design.md, Decision 3. */
export const SafFile = registerPlugin<SafFilePlugin>('SafFile');
