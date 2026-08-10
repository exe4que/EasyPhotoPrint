import { Preferences } from '@capacitor/preferences';

import type { AppSettings, EppAPI } from './contract.js';

const SETTINGS_KEY = 'epp-settings';
const DEFAULT_SETTINGS: AppSettings = {
  unitSystem: 'metric',
};

function noop(): void {
  // intentionally empty: Android has no native menu bar to unsubscribe from
}

function notImplementedYet(member: string, task: string): never {
  throw new Error(`androidAdapter.${member} is not implemented yet (see openspec/changes/android-shell/tasks.md, task ${task}).`);
}

async function readSettings(): Promise<AppSettings> {
  const { value } = await Preferences.get({ key: SETTINGS_KEY });
  if (value == null) {
    return DEFAULT_SETTINGS;
  }

  const parsed = JSON.parse(value) as Partial<AppSettings>;
  return {
    unitSystem: parsed.unitSystem === 'imperial' ? 'imperial' : 'metric',
    defaultPrinterName: parsed.defaultPrinterName,
  };
}

async function writeSettings(settings: AppSettings): Promise<AppSettings> {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) });
  return settings;
}

/** The Android host's adapter, registered by `src/main.android.tsx` before first render. Settings
 * are backed by `@capacitor/preferences` (SharedPreferences); menu subscriptions are no-ops, since
 * Android has no native menu bar (see the `platform-adapter` capability's totality requirement).
 * The remaining namespaces are implemented incrementally across `openspec/changes/android-shell/tasks.md`
 * section 4-7 -- see `notImplementedYet` call sites for exactly what's still pending. */
export function createAndroidAdapter(): EppAPI {
  return {
    dialog: {
      openImages: () => notImplementedYet('dialog.openImages', '7.1'),
      relinkImage: () => notImplementedYet('dialog.relinkImage', '7.2'),
    },
    fs: {
      openProject: () => notImplementedYet('fs.openProject', '7.3'),
      saveProject: () => notImplementedYet('fs.saveProject', '7.4'),
      resetWorkingStorage: () => notImplementedYet('fs.resetWorkingStorage', '7.5'),
    },
    images: {
      decodeAtSize: () => notImplementedYet('images.decodeAtSize', '7.6'),
    },
    menu: {
      onNewProject: () => noop,
      onOpenProject: () => noop,
      onSaveProject: () => noop,
      onSaveProjectAs: () => noop,
      onUndo: () => noop,
      onRedo: () => noop,
      onSaveTemplate: () => noop,
      onSaveTemplateAs: () => noop,
    },
    pdf: {
      export: () => notImplementedYet('pdf.export', '7.7'),
    },
    print: {
      document: () => notImplementedYet('print.document', '7.8'),
    },
    settings: {
      get: readSettings,
      set: async (patch) => {
        const current = await readSettings();
        const next: AppSettings = {
          unitSystem: patch.unitSystem ?? current.unitSystem,
          defaultPrinterName: patch.defaultPrinterName === undefined ? current.defaultPrinterName : patch.defaultPrinterName,
        };
        return writeSettings(next);
      },
    },
    templates: {
      list: () => notImplementedYet('templates.list', '7.9'),
      save: () => notImplementedYet('templates.save', '7.9'),
      delete: () => notImplementedYet('templates.delete', '7.9'),
    },
  };
}
