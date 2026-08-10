import { app, ipcMain } from 'electron';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { EPPProject } from '@epp/layout-engine';

import { resolvePageSizeMm } from '../../../src/lib/page.js';
import { mmToMicrons } from '../../../src/lib/units.js';
import { composeProjectPdf } from '../pdf/composeProjectPdf.js';
import { printPdfFile, type PrintPageSizeMicrons } from '../print-render/pdfPrintWindow.js';

const PRINT_DOCUMENT_CHANNEL = 'print:document';

/** A print job carries a single paper size, and every page in a project now always shares the
 * same `sheetSize` -- but pages may each have their own orientation, so the first page's
 * orientation decides the job's paper orientation, which is the documented best-effort behaviour
 * for a mixed-orientation project (see the `printing` capability). Export PDF has no such
 * limitation. */
function resolveJobPageSize(project: EPPProject): PrintPageSizeMicrons {
  const firstPage = project.pages[0];
  if (!firstPage) {
    throw new Error('The project has no pages to print.');
  }

  const sizeMm = resolvePageSizeMm(project.sheetSize, firstPage.pageConfig.orientation);
  return { width: mmToMicrons(sizeMm.widthMm), height: mmToMicrons(sizeMm.heightMm) };
}

export function registerPrintHandlers(): void {
  ipcMain.removeHandler(PRINT_DOCUMENT_CHANNEL);
  ipcMain.handle(PRINT_DOCUMENT_CHANNEL, async (_event, project: EPPProject): Promise<void> => {
    const pageSize = resolveJobPageSize(project);
    const pdfBytes = await composeProjectPdf(project);
    const tempFilePath = join(app.getPath('temp'), `easy-photo-print-${crypto.randomUUID()}.pdf`);

    await writeFile(tempFilePath, pdfBytes);
    try {
      await printPdfFile(tempFilePath, pageSize);
    } finally {
      await unlink(tempFilePath).catch(() => {
        // Best-effort cleanup -- a leftover temp file isn't worth failing an otherwise-completed print for.
      });
    }
  });
}
