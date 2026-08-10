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

/** Assembles the full `EPPProject` payload IPC calls that operate on the whole document (save,
 * PDF export, print) send across the boundary -- the same fields, from the same state slices,
 * every time. */
function buildEppProject(state: Pick<EPPStore, 'project' | 'document' | 'imagePool'>): EPPProject {
  return {
    schemaVersion: '1.0.0',
    id: state.project.id,
    name: state.project.name,
    sheetSize: state.document.sheetSize,
    pages: state.document.pages,
    imagePool: state.imagePool,
  };
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
    /** Composes the current project into a PDF and prompts a native save dialog. Returns the saved path, or null if canceled. */
    exportPdf: () => Promise<string | null>;
    /** Composes the current project into a PDF (every page, in order) and opens the native print dialog against it as a single job. */
    printDocument: () => Promise<void>;
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
      // (undoing an addPage) or at a stale neighbor (undoing a removePage). Re-anchoring here is a
      // plain, ui-only set() call -- the store's `equality` option (below, in temporal()'s config)
      // already keeps any ui-only set() out of tracked history, so no pause/resume is needed here.
      const reanchorActivePageId = () => {
        const state = get();
        if (state.document.pages.some((page) => page.id === state.ui.activePageId)) {
          return;
        }
        const fallback = state.document.pages[0];
        set({ ui: computeActivePageUi(state.ui, fallback.id, fallback) });
      };

      return {
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
          const project = buildEppProject(state);

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
        exportPdf: () => getEppApi().pdf.export(buildEppProject(get())),
        printDocument: () => getEppApi().print.document(buildEppProject(get())),
        openProject: async () => {
          const result = await getEppApi().fs.openProject();
          if (result == null) {
            return false;
          }

          const { project, filePath } = result;
          set({
            document: { sheetSize: project.sheetSize, pages: project.pages },
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
            document: { ...s.document, pages: [...s.document.pages, newPage] },
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
            set({ document: { ...state.document, pages: remainingPages } });
            return;
          }

          const neighbor = remainingPages[Math.min(removedIndex, remainingPages.length - 1)];
          set((s) => ({
            document: { ...s.document, pages: remainingPages },
            ui: computeActivePageUi(s.ui, neighbor.id, neighbor),
          }));
        },
      };
    },
    {
      partialize: (state) => ({
        document: state.document,
      }),
      // Without this, zundo pushes a pastState on every set() call regardless of whether the
      // tracked (partialized) state actually changed -- every document-mutating action always
      // constructs a fresh `document` object (never mutates in place), so a set() call that
      // leaves this reference untouched genuinely changed nothing worth tracking.
      equality: (pastState, currentState) => pastState.document === currentState.document,
    },
  ),
);

