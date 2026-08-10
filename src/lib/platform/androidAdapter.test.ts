import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      store.set(key, value);
    },
  },
}));

const { createAndroidAdapter } = await import('./androidAdapter.js');

describe('createAndroidAdapter', () => {
  beforeEach(() => {
    store.clear();
  });

  describe('settings', () => {
    it('returns the default settings when nothing has been stored yet', async () => {
      const adapter = createAndroidAdapter();
      await expect(adapter.settings.get()).resolves.toEqual({ unitSystem: 'metric', defaultPrinterName: undefined });
    });

    it('persists a patch and returns it from a subsequent get', async () => {
      const adapter = createAndroidAdapter();
      await adapter.settings.set({ unitSystem: 'imperial' });

      await expect(adapter.settings.get()).resolves.toEqual({ unitSystem: 'imperial', defaultPrinterName: undefined });
    });

    it('merges a patch with the previously stored settings rather than replacing them', async () => {
      const adapter = createAndroidAdapter();
      await adapter.settings.set({ defaultPrinterName: 'Office Printer' });
      await adapter.settings.set({ unitSystem: 'imperial' });

      await expect(adapter.settings.get()).resolves.toEqual({
        unitSystem: 'imperial',
        defaultPrinterName: 'Office Printer',
      });
    });
  });

  describe('menu', () => {
    it('every subscription returns a callable unsubscribe function and never invokes the callback', () => {
      const adapter = createAndroidAdapter();
      const subscriptions = [
        adapter.menu.onNewProject,
        adapter.menu.onOpenProject,
        adapter.menu.onSaveProject,
        adapter.menu.onSaveProjectAs,
        adapter.menu.onUndo,
        adapter.menu.onRedo,
        adapter.menu.onSaveTemplate,
        adapter.menu.onSaveTemplateAs,
      ] as const;

      for (const subscribe of subscriptions) {
        const callback = vi.fn();
        const unsubscribe = subscribe(callback);

        expect(typeof unsubscribe).toBe('function');
        expect(() => unsubscribe()).not.toThrow();
        expect(callback).not.toHaveBeenCalled();
      }
    });
  });
});
