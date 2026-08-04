import { create } from 'zustand';
import { temporal } from 'zundo';

import type { EPPProject } from '@epp/layout-engine';

import { getEppApi } from '../lib/ipc-client.js';
import { createDocumentSlice, createInitialDocumentState, type DocumentSlice } from './documentSlice.js';
import { createImagePoolSlice, type ImagePoolSlice } from './imagePoolSlice.js';
import { createInitialProjectState, createProjectSlice, type ProjectSlice } from './projectSlice.js';
import { createSettingsSlice, type SettingsSlice } from './settingsSlice.js';
import { createInitialUiState, createUiSlice, type UiSlice } from './uiSlice.js';

/** Derives a project's display name from a chosen file path, e.g. "/a/b/My Album.eppproj" -> "My Album". */
function deriveProjectNameFromPath(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  return base.replace(/\.eppproj$/i, '') || 'Untitled';
}

export type EPPStore = DocumentSlice &
  UiSlice &
  ImagePoolSlice &
  SettingsSlice &
  ProjectSlice & {
    pauseHistory: () => void;
    resumeHistory: () => void;
    /** Discards the current document, image pool, and undo/redo history — resets to the same state as a fresh app launch (File > New). */
    startNewProject: () => void;
    /** Saves the current document. Prompts for a path only if none is remembered yet, or forceDialog ("Save As") is true. */
    saveProject: (forceDialog: boolean) => Promise<void>;
    /** Opens a project from disk, replacing the current document/image pool and clearing undo/redo history. Returns false (no-op) if the native picker was canceled, true if a project was loaded. */
    openProject: () => Promise<boolean>;
    /** Relinks a "missing" ImageAsset to a newly chosen file. No-op if the native picker is canceled. */
    relinkImage: (imageAssetId: string) => Promise<void>;
  };

export const useEPPStore = create<EPPStore>()(
  temporal(
    (set, get) => ({
      ...createDocumentSlice(set as never, get as never),
      ...createUiSlice(set as never, get as never),
      ...createImagePoolSlice(set as never),
      ...createSettingsSlice(set as never),
      ...createProjectSlice(),
      pauseHistory: () => {
        useEPPStore.temporal.getState().pause();
      },
      resumeHistory: () => {
        useEPPStore.temporal.getState().resume();
      },
      startNewProject: () => {
        set({
          document: createInitialDocumentState(),
          ui: createInitialUiState(),
          imagePool: [],
          project: createInitialProjectState(),
        });
        useEPPStore.temporal.getState().clear();
      },
      saveProject: async (forceDialog) => {
        const state = get();
        const project: EPPProject = {
          schemaVersion: '1.0.0',
          id: state.project.id,
          name: state.project.name,
          pages: state.document.pages,
          imagePool: state.imagePool,
        };

        const resolvedPath = await getEppApi().fs.saveProject(project, {
          existingPath: state.project.filePath,
          forceDialog,
        });
        if (resolvedPath == null) {
          return;
        }

        set((s) => ({
          project: { ...s.project, filePath: resolvedPath, name: deriveProjectNameFromPath(resolvedPath) },
        }));
      },
      openProject: async () => {
        const result = await getEppApi().fs.openProject();
        if (result == null) {
          return false;
        }

        const { project, filePath } = result;
        set({
          document: { pages: project.pages },
          imagePool: project.imagePool,
          project: { id: project.id, name: project.name, filePath },
        });
        useEPPStore.temporal.getState().clear();
        return true;
      },
      relinkImage: async (imageAssetId) => {
        const refreshed = await getEppApi().dialog.relinkImage();
        if (refreshed == null) {
          return;
        }

        set((s) => ({
          imagePool: s.imagePool.map((asset) =>
            asset.id === imageAssetId ? { ...asset, ...refreshed, missing: undefined } : asset,
          ),
        }));
      },
    }),
    {
      partialize: (state) => ({
        document: state.document,
      }),
    },
  ),
);

