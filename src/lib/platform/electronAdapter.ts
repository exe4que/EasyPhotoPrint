import type { EppAPI } from './contract.js';

declare global {
  interface Window {
    eppAPI: EppAPI;
  }
}

/** The Electron host's adapter: a pass-through over the `window.eppAPI` object the preload
 * script exposes via `contextBridge`, not a per-method forwarding wrapper -- desktop behavior
 * stays byte-for-byte what it was before the platform-adapter seam existed (see design.md,
 * decision 2, in the `extract-platform-adapter` change). */
export function createElectronAdapter(): EppAPI {
  if (typeof window === 'undefined' || window.eppAPI == null) {
    throw new Error('window.eppAPI is not available -- the Electron preload script did not run or did not expose it.');
  }

  return window.eppAPI;
}
