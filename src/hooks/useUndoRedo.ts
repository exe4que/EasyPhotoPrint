// @spec OPENSPEC.md §4.2, §6.1 — wrappers over zundo temporal history controls
import { useMemo } from 'react';

import { useEPPStore } from '../store/index.js';

export function useUndoRedo() {
  return useMemo(
    () => ({
      undo: () => useEPPStore.temporal.getState().undo(),
      redo: () => useEPPStore.temporal.getState().redo(),
      pauseHistory: () => useEPPStore.temporal.getState().pause(),
      resumeHistory: () => useEPPStore.temporal.getState().resume(),
      clearHistory: () => useEPPStore.temporal.getState().clear(),
    }),
    [],
  );
}

