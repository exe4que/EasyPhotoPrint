import { dialog, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';

import type { EPPProject } from '@epp/layout-engine';

import { composeProjectPdf } from '../pdf/composeProjectPdf.js';

const EXPORT_PDF_CHANNEL = 'pdf:export';

export function registerPdfHandlers(): void {
  ipcMain.removeHandler(EXPORT_PDF_CHANNEL);
  ipcMain.handle(EXPORT_PDF_CHANNEL, async (_event, project: EPPProject): Promise<string | null> => {
    const result = await dialog.showSaveDialog({
      title: 'Export PDF',
      defaultPath: `${project.name || 'Untitled'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    const pdfBytes = await composeProjectPdf(project);
    await writeFile(result.filePath, pdfBytes);
    return result.filePath;
  });
}
