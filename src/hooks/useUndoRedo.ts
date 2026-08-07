import { useMemo } from 'react';

import { useEPPStore } from '../store/index.js';

export function useUndoRedo() {
  return useMemo(
    () => ({
      undo: () => useEPPStore.getState().undo(),
      redo: () => useEPPStore.getState().redo(),
      pauseHistory: () => useEPPStore.temporal.getState().pause(),
      resumeHistory: () => useEPPStore.temporal.getState().resume(),
      clearHistory: () => useEPPStore.temporal.getState().clear(),
    }),
    [],
  );
}

