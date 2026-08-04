import { getEppApi, type AppSettings } from '../lib/ipc-client.js';

export interface SettingsSlice {
  settings: AppSettings;
  hydrateSettings: () => Promise<void>;
  setUnitSystem: (unitSystem: AppSettings['unitSystem']) => Promise<void>;
}

export function createSettingsSlice(
  set: (
    updater: (state: { settings: AppSettings }) => Partial<{ settings: AppSettings }>,
  ) => void,
): SettingsSlice {
  return {
    settings: {
      unitSystem: 'metric',
    },
    hydrateSettings: async () => {
      const settings = await getEppApi().settings.get();
      set(() => ({ settings }));
    },
    setUnitSystem: async (unitSystem) => {
      const settings = await getEppApi().settings.set({ unitSystem });
      set(() => ({ settings }));
    },
  };
}

