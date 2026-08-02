import { describe, expect, it } from 'vitest';

import { resolvePatchedSettings } from './settings.helpers.js';

describe('resolvePatchedSettings', () => {
  it('allows switching from metric to imperial', () => {
    expect(
      resolvePatchedSettings(
        { unitSystem: 'metric' },
        { unitSystem: 'imperial' },
      ),
    ).toEqual({ unitSystem: 'imperial' });
  });

  it('allows switching from imperial back to metric', () => {
    expect(
      resolvePatchedSettings(
        { unitSystem: 'imperial' },
        { unitSystem: 'metric' },
      ),
    ).toEqual({ unitSystem: 'metric' });
  });

  it('preserves other settings unless explicitly patched', () => {
    expect(
      resolvePatchedSettings(
        { unitSystem: 'metric', defaultPrinterName: 'Printer A' },
        {},
      ),
    ).toEqual({ unitSystem: 'metric', defaultPrinterName: 'Printer A' });
  });
});
