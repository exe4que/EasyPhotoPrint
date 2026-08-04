import { create } from 'zustand';
import { temporal } from 'zundo';

import { createDocumentSlice, createInitialDocumentState, type DocumentSlice } from './documentSlice.js';
import { createImagePoolSlice, type ImagePoolSlice } from './imagePoolSlice.js';
import { createSettingsSlice, type SettingsSlice } from './settingsSlice.js';
import { createInitialUiState, createUiSlice, type UiSlice } from './uiSlice.js';

export type EPPStore = DocumentSlice &
  UiSlice &
  ImagePoolSlice &
  SettingsSlice & {
    pauseHistory: () => void;
    resumeHistory: () => void;
    /** Discards the current document, image pool, and undo/redo history — resets to the same state as a fresh app launch (File > New). */
    startNewProject: () => void;
  };

export const useEPPStore = create<EPPStore>()(
  temporal(
    (set, get) => ({
      ...createDocumentSlice(set as never, get as never),
      ...createUiSlice(set as never, get as never),
      ...createImagePoolSlice(set as never),
      ...createSettingsSlice(set as never),
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
        });
        useEPPStore.temporal.getState().clear();
      },
    }),
    {
      partialize: (state) => ({
        document: state.document,
      }),
    },
  ),
);

