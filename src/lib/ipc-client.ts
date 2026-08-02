// @spec OPENSPEC.md §2.2, §2.4, §6.1 — typed renderer access to preload IPC bridge
import type { EPPProject, EPPTemplate, ImageAsset } from '@epp/layout-engine';

export interface AppSettings {
  unitSystem: 'metric' | 'imperial';
  defaultPrinterName?: string;
}

export interface EppAPI {
  dialog: {
    openImages: () => Promise<ImageAsset[]>;
  };
  fs: {
    openProject: () => Promise<EPPProject>;
    saveProject: (project: EPPProject) => Promise<void>;
  };
  pdf: {
    export: (project: EPPProject) => Promise<Uint8Array>;
  };
  print: {
    document: (project: EPPProject) => Promise<void>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    set: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  };
  templates: {
    list: () => Promise<EPPTemplate[]>;
    save: (template: EPPTemplate) => Promise<void>;
  };
}

export function getEppApi(): EppAPI {
  if (typeof window === 'undefined' || window.eppAPI == null) {
    throw new Error('window.eppAPI is not available outside the Electron renderer process.');
  }

  return window.eppAPI;
}

declare global {
  interface Window {
    eppAPI: EppAPI;
  }
}
