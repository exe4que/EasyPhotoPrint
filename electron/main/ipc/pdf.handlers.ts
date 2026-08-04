import { ipcMain } from 'electron';

const EXPORT_PDF_CHANNEL = 'pdf:export';

export function registerPdfHandlers(): void {
  ipcMain.removeHandler(EXPORT_PDF_CHANNEL);
  ipcMain.handle(EXPORT_PDF_CHANNEL, async () => {
    throw new Error('PDF export is not implemented yet.');
  });
}

