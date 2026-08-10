import { describe, expect, it, vi } from 'vitest';

import type { EppAPI } from './contract.js';
import { getEppApi, registerPlatformAdapter } from './contract.js';

function fakeAdapter(overrides: Partial<EppAPI> = {}): EppAPI {
  return overrides as EppAPI;
}

describe('platform adapter registry', () => {
  it('throws a clear error when no adapter has been registered yet', async () => {
    vi.resetModules();
    const fresh = await import('./contract.js');

    expect(() => fresh.getEppApi()).toThrow(/no platform adapter has been registered/i);
  });

  describe('once an adapter is registered', () => {
    it('getEppApi returns the registered adapter', () => {
      const adapter = fakeAdapter({ settings: { get: async () => ({ unitSystem: 'metric' }), set: async () => ({ unitSystem: 'metric' }) } });

      registerPlatformAdapter(adapter);

      expect(getEppApi()).toBe(adapter);
    });

    it('registering again replaces the previous adapter', () => {
      const first = fakeAdapter();
      const second = fakeAdapter();

      registerPlatformAdapter(first);
      expect(getEppApi()).toBe(first);

      registerPlatformAdapter(second);
      expect(getEppApi()).toBe(second);
    });
  });
});
