import { ipcMain } from 'electron';

const PRINT_DOCUMENT_CHANNEL = 'print:document';

export function registerPrintHandlers(): void {
  ipcMain.removeHandler(PRINT_DOCUMENT_CHANNEL);
  ipcMain.handle(PRINT_DOCUMENT_CHANNEL, async () => {
    throw new Error('Printing through the PDF pipeline is not implemented yet.');
  });
}

