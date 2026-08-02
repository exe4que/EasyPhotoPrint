import { registerFsHandlers } from './fs.handlers.js';
import { registerPdfHandlers } from './pdf.handlers.js';
import { registerPrintHandlers } from './print.handlers.js';
import { registerSettingsHandlers } from './settings.handlers.js';
import { registerTemplateHandlers } from './templates.handlers.js';

export function registerIpcHandlers(): void {
  registerFsHandlers();
  registerPdfHandlers();
  registerPrintHandlers();
  registerSettingsHandlers();
  registerTemplateHandlers();
}

