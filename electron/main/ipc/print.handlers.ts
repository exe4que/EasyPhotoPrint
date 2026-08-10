import { app, ipcMain } from 'electron';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { EPPProject } from '@epp/layout-engine';

import { composeProjectPdf } from '../pdf/composeProjectPdf.js';
import { printPdfFile } from '../print-render/pdfPrintWindow.js';

const PRINT_DOCUMENT_CHANNEL = 'print:document';

export function registerPrintHandlers(): void {
  ipcMain.removeHandler(PRINT_DOCUMENT_CHANNEL);
  ipcMain.handle(PRINT_DOCUMENT_CHANNEL, async (_event, project: EPPProject): Promise<void> => {
    const pdfBytes = await composeProjectPdf(project);
    const tempFilePath = join(app.getPath('temp'), `easy-photo-print-${crypto.randomUUID()}.pdf`);

    await writeFile(tempFilePath, pdfBytes);
    try {
      await printPdfFile(tempFilePath);
    } finally {
      await unlink(tempFilePath).catch(() => {
        // Best-effort cleanup -- a leftover temp file isn't worth failing an otherwise-completed print for.
      });
    }
  });
}
