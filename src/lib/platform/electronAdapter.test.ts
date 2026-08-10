import { afterEach, describe, expect, it } from 'vitest';

import { createElectronAdapter } from './electronAdapter.js';

describe('createElectronAdapter', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('throws a clear error identifying the missing Electron preload surface when window.eppAPI is absent', () => {
    expect(() => createElectronAdapter()).toThrow(/window\.eppAPI is not available/i);
  });

  it('returns window.eppAPI directly (a pass-through, not a copy)', () => {
    const eppAPI = { dialog: {} } as unknown as ReturnType<typeof createElectronAdapter>;
    (globalThis as { window?: unknown }).window = { eppAPI };

    expect(createElectronAdapter()).toBe(eppAPI);
  });
});
