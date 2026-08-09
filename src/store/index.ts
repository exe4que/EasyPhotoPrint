import { create } from 'zustand';
import { temporal } from 'zundo';

import type { EPPProject } from '@epp/layout-engine';

import { getEppApi } from '../lib/ipc-client.js';
import { createDefaultPage, createDocumentSlice, createInitialDocumentState, type DocumentSlice } from './documentSlice.js';
import { createImagePoolSlice, type ImagePoolSlice } from './imagePoolSlice.js';
import { createInitialProjectState, createProjectSlice, type ProjectSlice } from './projectSlice.js';
import { createSettingsSlice, type SettingsSlice } from './settingsSlice.js';
import { computeActivePageUi, createInitialUiState, createUiSlice, type UiSlice } from './uiSlice.js';

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
    /** Reverts the most recent document change, then re-anchors ui.activePageId to a real page if the reverted document no longer contains it (e.g. undoing an addPage). */
    undo: () => void;
    /** Re-applies the most recently undone document change, then re-anchors ui.activePageId to a real page if needed. */
    redo: () => void;
    /** Discards the current document, image pool, and undo/redo history — resets to the same state as a fresh app launch (File > New). */
    startNewProject: () => void;
    /** Saves the current document. Prompts for a path only if none is remembered yet, or forceDialog ("Save As") is true. */
    saveProject: (forceDialog: boolean) => Promise<void>;
    /** Opens a project from disk, replacing the current document/image pool and clearing undo/redo history. Returns false (no-op) if the native picker was canceled, true if a project was loaded. */
    openProject: () => Promise<boolean>;
    /** Relinks a "missing" ImageAsset to a newly chosen file. No-op if the native picker is canceled. */
    relinkImage: (imageAssetId: string) => Promise<void>;
    /** Appends a new page with the app's default page config and a blank rootNode, and makes it the active page. */
    addPage: () => void;
    /** Removes a page. No-op if it's the only remaining page. If it was the active page, activates the neighboring page that shifts into its former position (or the previous page, if it was last). */
    removePage: (pageId: string) => void;
  };

export const useEPPStore = create<EPPStore>()(
  temporal(
    (set, get) => {
      // Undo/redo apply raw document snapshots (see undo-redo spec: ui is intentionally excluded
      // from tracked history), so activePageId can end up pointing at a page that no longer exists
      // (undoing an addPage) or at a stale neighbor (undoing a removePage). Re-anchoring here — outside
      // the tracked set() calls, wrapped in pause/resume so it never itself becomes a history entry —
      // keeps activePageId valid without ever tracking ui through zundo.
      const reanchorActivePageId = () => {
        const state = get();
        if (state.document.pages.some((page) => page.id === state.ui.activePageId)) {
          return;
        }
        const fallback = state.document.pages[0];
        useEPPStore.temporal.getState().pause();
        set({ ui: computeActivePageUi(state.ui, fallback.id, fallback) });
        useEPPStore.temporal.getState().resume();
      };

      return {
        ...createDocumentSlice(set as never, get as never),
        ...createUiSlice(set as never, get as never),
        ...createImagePoolSlice(set as never),
        ...createSettingsSlice(set as never),
        ...createProjectSlice(),
        // Overrides createUiSlice's plain setViewMode: without pausing, zundo's temporal `set()`
        // wrapper pushes a pastState on every call regardless of whether the tracked `document`
        // slice actually changed (see zundo's temporalHandleSet, which only skips a push when a
        // `diff`/`equality` option says nothing changed -- this store configures neither). Same
        // pause/resume precaution reanchorActivePageId already needs below for the same reason.
        setViewMode: (viewMode) => {
          useEPPStore.temporal.getState().pause();
          set((state) => ({ ui: { ...state.ui, viewMode } }));
          useEPPStore.temporal.getState().resume();
        },
        pauseHistory: () => {
          useEPPStore.temporal.getState().pause();
        },
        resumeHistory: () => {
          useEPPStore.temporal.getState().resume();
        },
        undo: () => {
          useEPPStore.temporal.getState().undo();
          reanchorActivePageId();
        },
        redo: () => {
          useEPPStore.temporal.getState().redo();
          reanchorActivePageId();
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
        addPage: () => {
          // A single set() call for both document and ui: zundo pushes one history entry per
          // set() call regardless of whether the tracked (document) slice actually changed, so
          // calling the separate setActivePageId action here would fragment this into two undo
          // steps instead of one.
          const newPage = createDefaultPage();
          set((s) => ({
            document: { pages: [...s.document.pages, newPage] },
            ui: computeActivePageUi(s.ui, newPage.id, newPage),
          }));
        },
        removePage: (pageId) => {
          const state = get();
          if (state.document.pages.length <= 1) {
            return;
          }

          const removedIndex = state.document.pages.findIndex((page) => page.id === pageId);
          if (removedIndex === -1) {
            return;
          }

          const remainingPages = state.document.pages.filter((page) => page.id !== pageId);

          if (state.ui.activePageId !== pageId) {
            set({ document: { pages: remainingPages } });
            return;
          }

          const neighbor = remainingPages[Math.min(removedIndex, remainingPages.length - 1)];
          set((s) => ({
            document: { pages: remainingPages },
            ui: computeActivePageUi(s.ui, neighbor.id, neighbor),
          }));
        },
      };
    },
    {
      partialize: (state) => ({
        document: state.document,
      }),
    },
  ),
);

