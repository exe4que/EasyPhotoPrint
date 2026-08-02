// @spec OPENSPEC.md §2.4 — AppSettings persistence and IPC
import { app, ipcMain } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { resolvePatchedSettings } from './settings.helpers.js';

export interface AppSettings {
  unitSystem: 'metric' | 'imperial';
  defaultPrinterName?: string;
}

const SETTINGS_GET_CHANNEL = 'settings:get';
const SETTINGS_SET_CHANNEL = 'settings:set';
const DEFAULT_SETTINGS: AppSettings = {
  unitSystem: 'metric',
};

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

async function readSettingsFile(): Promise<AppSettings> {
  try {
    const raw = await readFile(getSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      unitSystem: parsed.unitSystem === 'imperial' ? 'imperial' : 'metric',
      defaultPrinterName: parsed.defaultPrinterName,
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return DEFAULT_SETTINGS;
    }

    throw error;
  }
}

async function writeSettingsFile(settings: AppSettings): Promise<AppSettings> {
  const settingsPath = getSettingsPath();
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  return settings;
}

export function registerSettingsHandlers(): void {
  ipcMain.removeHandler(SETTINGS_GET_CHANNEL);
  ipcMain.removeHandler(SETTINGS_SET_CHANNEL);

  ipcMain.handle(SETTINGS_GET_CHANNEL, async () => {
    return readSettingsFile();
  });

  ipcMain.handle(SETTINGS_SET_CHANNEL, async (_event, patch: Partial<AppSettings>) => {
    const current = await readSettingsFile();
    const nextSettings = resolvePatchedSettings(current, patch);
    return writeSettingsFile(nextSettings);
  });
}

