import type { EPPProject, EPPTemplate, ImageAsset } from '@epp/layout-engine';

export interface AppSettings {
  unitSystem: 'metric' | 'imperial';
  defaultPrinterName?: string;
}

export interface EppAPI {
  dialog: {
    openImages: () => Promise<ImageAsset[]>;
    /** Native single-file picker for repairing a "missing" ImageAsset; null if canceled. */
    relinkImage: () => Promise<Omit<ImageAsset, 'id'> | null>;
  };
  fs: {
    /** Shows the native "open project" picker scoped to .eppproj; null if canceled. */
    openProject: () => Promise<{ project: EPPProject; filePath: string } | null>;
    /** existingPath is the project's currently remembered file path (null if never saved); forceDialog is true for "Save As". Returns the resolved path, or null if canceled. */
    saveProject: (project: EPPProject, options: { existingPath: string | null; forceDialog: boolean }) => Promise<string | null>;
  };
  menu: {
    /** Subscribes to the native "File > New" menu click; returns an unsubscribe function. */
    onNewProject: (callback: () => void) => () => void;
    onOpenProject: (callback: () => void) => () => void;
    onSaveProject: (callback: () => void) => () => void;
    onSaveProjectAs: (callback: () => void) => () => void;
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
    save: (template: EPPTemplate) => Promise<EPPTemplate>;
    delete: (templateId: string) => Promise<void>;
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
