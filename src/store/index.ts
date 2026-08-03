// @spec OPENSPEC.md §2.3, §2.4 — combined Zustand store with zundo tracking over document state
import { create } from 'zustand';
import { temporal } from 'zundo';

import { createDocumentSlice, type DocumentSlice } from './documentSlice.js';
import { createImagePoolSlice, type ImagePoolSlice } from './imagePoolSlice.js';
import { createSettingsSlice, type SettingsSlice } from './settingsSlice.js';
import { createUiSlice, type UiSlice } from './uiSlice.js';

export type EPPStore = DocumentSlice &
  UiSlice &
  ImagePoolSlice &
  SettingsSlice & {
    pauseHistory: () => void;
    resumeHistory: () => void;
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
    }),
    {
      partialize: (state) => ({
        document: state.document,
      }),
    },
  ),
);

