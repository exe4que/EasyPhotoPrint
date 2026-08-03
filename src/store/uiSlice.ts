// @spec OPENSPEC.md §2.3 — transient UI slice for selection and mode state
export interface UiState {
  activePageId: string;
  selectedElementIds: string[];
  activeTool: 'select' | 'pan' | 'crop';
  layoutMode: 'simple' | 'nested';
}

export interface UiSlice {
  ui: UiState;
  setActivePageId: (pageId: string) => void;
  setSelectedElementIds: (ids: string[]) => void;
  setActiveTool: (tool: UiState['activeTool']) => void;
  setLayoutMode: (mode: UiState['layoutMode']) => void;
}

export function createUiSlice(
  set: (
    updater: (state: { ui: UiState }) => Partial<{ ui: UiState }>,
  ) => void,
): UiSlice {
  return {
    ui: {
      activePageId: 'page-1',
      selectedElementIds: [],
      activeTool: 'select',
      layoutMode: 'simple',
    },
    setActivePageId: (activePageId) => {
      set((state) => ({ ui: { ...state.ui, activePageId, selectedElementIds: [] } }));
    },
    setSelectedElementIds: (selectedElementIds) => {
      set((state) => ({ ui: { ...state.ui, selectedElementIds } }));
    },
    setActiveTool: (activeTool) => {
      set((state) => ({ ui: { ...state.ui, activeTool } }));
    },
    setLayoutMode: (layoutMode) => {
      set((state) => ({ ui: { ...state.ui, layoutMode } }));
    },
  };
}
