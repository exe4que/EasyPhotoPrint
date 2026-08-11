import { registerPlugin } from '@capacitor/core';

export interface PrintPlugin {
  /** Opens Android's native print dialog for an already-composed PDF. */
  printPdf(options: { base64: string; jobName: string }): Promise<void>;
}

/** See openspec/changes/android-shell/design.md, Decision 5. */
export const Print = registerPlugin<PrintPlugin>('Print');
