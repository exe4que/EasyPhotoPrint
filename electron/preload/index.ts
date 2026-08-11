import { contextBridge, ipcRenderer } from 'electron';

import type { EPPProject, EPPTemplate, ImageAsset } from '@epp/layout-engine';
import type { AppSettings } from '../main/ipc/settings.handlers.js';

const eppAPI = {
  dialog: {
    openImages: () => ipcRenderer.invoke('dialog:open-images') as Promise<ImageAsset[]>,
    relinkImage: () => ipcRenderer.invoke('dialog:relink-image') as Promise<Omit<ImageAsset, 'id'> | null>,
  },
  fs: {
    openProject: () => ipcRenderer.invoke('fs:open-project') as Promise<{ project: EPPProject; filePath: string } | null>,
    saveProject: (project: EPPProject, options: { existingPath: string | null; forceDialog: boolean }) =>
      ipcRenderer.invoke('fs:save-project', project, options) as Promise<string | null>,
    resetWorkingStorage: () => ipcRenderer.invoke('fs:reset-working-storage') as Promise<void>,
  },
  images: {
    decodeAtSize: (filePath: string, minWidthPx: number, minHeightPx: number) =>
      ipcRenderer.invoke('images:decode-at-size', filePath, minWidthPx, minHeightPx) as Promise<string>,
  },
  pdf: {
    export: (project: EPPProject) => ipcRenderer.invoke('pdf:export', project) as Promise<string | null>,
  },
  print: {
    document: (project: EPPProject) => ipcRenderer.invoke('print:document', project) as Promise<void>,
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
