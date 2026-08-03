// @spec OPENSPEC.md §2.2 — preload contextBridge with explicit API surface
import { contextBridge, ipcRenderer } from 'electron';

import type { EPPTemplate, ImageAsset } from '@epp/layout-engine';
import type { AppSettings } from '../main/ipc/settings.handlers.js';

const eppAPI = {
  dialog: {
    openImages: () => ipcRenderer.invoke('dialog:open-images') as Promise<ImageAsset[]>,
  },
  fs: {
    openProject: () => ipcRenderer.invoke('fs:open-project'),
    saveProject: (project: unknown) => ipcRenderer.invoke('fs:save-project', project),
  },
  menu: {
    onNewProject: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('menu:new-project', listener);
      return () => {
        ipcRenderer.removeListener('menu:new-project', listener);
      };
    },
  },
  pdf: {
    export: (project: unknown) => ipcRenderer.invoke('pdf:export', project) as Promise<Uint8Array>,
  },
  print: {
    document: (project: unknown) => ipcRenderer.invoke('print:document', project),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get') as Promise<AppSettings>,
    set: (patch: Partial<AppSettings>) => ipcRenderer.invoke('settings:set', patch) as Promise<AppSettings>,
  },
  templates: {
    list: () => ipcRenderer.invoke('templates:list') as Promise<EPPTemplate[]>,
    save: (template: unknown) => ipcRenderer.invoke('templates:save', template) as Promise<EPPTemplate>,
    delete: (templateId: string) => ipcRenderer.invoke('templates:delete', templateId) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('eppAPI', eppAPI);
