import { app, BrowserWindow } from 'electron';
import { pathToFileURL } from 'node:url';

const LOAD_TIMEOUT_MS = 15_000;

let printWindow: BrowserWindow | null = null;
let shuttingDown = false;

function createPrintWindow(): BrowserWindow {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Required for Electron's built-in Chrome PDF Viewer to render a navigated .pdf URL.
      plugins: true,
    },
  });

  window.on('closed', () => {
    if (printWindow === window) {
      printWindow = null;
    }
  });

  return window;
}

/** Lazily creates, and reuses across calls, the single hidden window used to host Chromium's
 * built-in PDF viewer long enough to print a composed document -- it never runs any of this app's
 * own renderer code, only the PDF file it's pointed at. */
function getPrintWindow(): BrowserWindow {
  if (shuttingDown) {
    throw new Error('The application is shutting down.');
  }
  if (!printWindow || printWindow.isDestroyed()) {
    printWindow = createPrintWindow();
  }
  return printWindow;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/** Physical size of the paper to request for the print job, in microns (Electron's unit for
 * `pageSize`), already resolved for orientation -- a landscape A4 is `{ width: 297000, height: 210000 }`. */
export interface PrintPageSizeMicrons {
  width: number;
  height: number;
}

/** Loads `pdfFilePath` into the hidden window and opens the native print dialog against it once
 * loaded. Resolves whether the user prints or cancels the dialog -- both are non-error outcomes
 * per the `printing` spec; only a load failure/timeout or an actual print-pipeline error rejects.
 *
 * `pageSize` must be passed explicitly: with no `pageSize`, Chromium falls back to a portrait
 * default (measured: a 297x210mm landscape document printed onto a 210x297mm portrait sheet), which
 * silently scales the whole document down to fit. Note that Electron's `landscape` flag does NOT
 * achieve this -- passing portrait dimensions plus `landscape: true` was measured to still produce a
 * portrait sheet; the already-oriented width/height is what actually decides the paper. `marginType:
 * 'none'` and `scaleFactor: 100` keep the composed PDF at 1:1 instead of being shrunk to fit a
 * margined content area. */
export async function printPdfFile(pdfFilePath: string, pageSize: PrintPageSizeMicrons): Promise<void> {
  const window = getPrintWindow();

  await withTimeout(window.loadURL(pathToFileURL(pdfFilePath).toString()), LOAD_TIMEOUT_MS, 'Timed out preparing the document for printing.');

  await new Promise<void>((resolve, reject) => {
    window.webContents.print({ pageSize, margins: { marginType: 'none' }, scaleFactor: 100 }, (success, failureReason) => {
      if (!success && failureReason !== 'cancelled') {
        reject(new Error(`Printing failed: ${failureReason}`));
        return;
      }
      resolve();
    });
  });
}

app.on('before-quit', () => {
  shuttingDown = true;
  if (printWindow && !printWindow.isDestroyed()) {
    printWindow.destroy();
  }
  printWindow = null;
});
