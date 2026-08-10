import type { EPPProject, EPPTemplate, ImageAsset } from '@epp/layout-engine';

export interface AppSettings {
  unitSystem: 'metric' | 'imperial';
  defaultPrinterName?: string;
}

/** The single contract shared renderer code uses to reach every host-provided capability --
 * file pickers, project storage, PDF export, printing, settings, templates, image decoding, and
 * host-initiated commands. Every adapter implements every member (see the `platform-adapter`
 * capability's "Platform Contract Is Total" requirement); a host that lacks a capability absorbs
 * that inside its own adapter rather than this contract growing optional members. */
export interface EppAPI {
  dialog: {
    openImages: () => Promise<ImageAsset[]>;
    /** Native single-file picker for repairing a "missing" ImageAsset; null if canceled. */
    relinkImage: () => Promise<Omit<ImageAsset, 'id'> | null>;
  };
  fs: {
    /** Shows the native "open project" picker scoped to .eppproj; null if canceled. */
    openProject: () => Promise<{ project: EPPProject; filePath: string } | null>;
    /** existingPath is the project's currently remembered file path (null if never saved); forceDialog is true for "Save As". Returns the resolved path, or null if canceled. Both are opaque location identifiers -- round-trip them unmodified, never join/resolve/normalize them (see the `platform-adapter` capability's "Location Identifiers Are Opaque" requirement). */
    saveProject: (project: EPPProject, options: { existingPath: string | null; forceDialog: boolean }) => Promise<string | null>;
  };
  images: {
    /** Decodes filePath at (up to) native resolution, only as small as still covers (minWidthPx, minHeightPx) -- used for print-resolution preview rendering, distinct from an ImageAsset's bounded-edge thumbnailDataUrl. */
    decodeAtSize: (filePath: string, minWidthPx: number, minHeightPx: number) => Promise<string>;
  };
  menu: {
    /** Subscribes to the host's "File > New" command; returns an unsubscribe function. A host with no native menu (e.g. no menu bar) implements this as a no-op subscription that still returns a working unsubscribe. */
    onNewProject: (callback: () => void) => () => void;
    onOpenProject: (callback: () => void) => () => void;
    onSaveProject: (callback: () => void) => () => void;
    onSaveProjectAs: (callback: () => void) => () => void;
    /** Subscribes to the host's "Edit > Undo"/"Edit > Redo" commands (and their accelerators, where the host has any); returns an unsubscribe function. */
    onUndo: (callback: () => void) => () => void;
    onRedo: (callback: () => void) => () => void;
    /** Subscribes to the host's "Edit > Save Template"/"Edit > Save Template As..." commands; returns an unsubscribe function. */
    onSaveTemplate: (callback: () => void) => () => void;
    onSaveTemplateAs: (callback: () => void) => () => void;
  };
  pdf: {
    /** Prompts a native save dialog and writes the exported PDF there; returns the saved path, or null if canceled. */
    export: (project: EPPProject) => Promise<string | null>;
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

let registeredAdapter: EppAPI | null = null;

/** Registers the concrete adapter for the current host. Each host's own entry point calls this
 * once, before the app renders for the first time -- shared code never selects an adapter itself.
 * Registering again replaces whatever was previously registered. */
export function registerPlatformAdapter(adapter: EppAPI): void {
  registeredAdapter = adapter;
}

/** Returns the registered platform adapter. Shared renderer code SHALL call this at the point of
 * use rather than capturing the result at module scope, so it never runs before the host's entry
 * point has registered its adapter. */
export function getEppApi(): EppAPI {
  if (registeredAdapter == null) {
    throw new Error('No platform adapter has been registered. Call registerPlatformAdapter() before rendering the app.');
  }

  return registeredAdapter;
}
