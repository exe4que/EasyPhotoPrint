// @spec OPENSPEC.md §2.4 — AppSettings merge semantics for persistence
import type { AppSettings } from './settings.handlers.js';

export function resolvePatchedSettings(current: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return {
    unitSystem: patch.unitSystem ?? current.unitSystem,
    defaultPrinterName:
      patch.defaultPrinterName === undefined ? current.defaultPrinterName : patch.defaultPrinterName,
  };
}

