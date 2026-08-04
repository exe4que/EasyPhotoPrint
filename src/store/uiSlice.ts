import type { EPPProjectPage } from '@epp/layout-engine';

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
  clearSelection: () => void;
}

export function createInitialUiState(): UiState {
  return {
    activePageId: 'page-1',
    selectedElementIds: [],
    activeTool: 'select',
    layoutMode: 'simple',
  };
}

interface UiSliceDependencies {
  ui: UiState;
  document: { pages: EPPProjectPage[] };
}

/**
 * In Simple mode there is no LayoutTree to reselect the root from, so an empty selection
 * would leave the root's Container/Slot properties permanently unreachable (§2.3). Deselect
 * actions fall back to the active page's root instead of an empty selection.
 */
function computeDefaultSelection(layoutMode: UiState['layoutMode'], page: EPPProjectPage | undefined): string[] {
  return layoutMode === 'simple' && page ? [page.rootNode.id] : [];
}

export function createUiSlice(
  set: (
    updater: (state: { ui: UiState }) => Partial<{ ui: UiState }>,
  ) => void,
  get: () => UiSliceDependencies,
): UiSlice {
  return {
    ui: createInitialUiState(),
    setActivePageId: (activePageId) => {
      const nextPage = get().document.pages.find((page) => page.id === activePageId);
      set((state) => ({
        ui: { ...state.ui, activePageId, selectedElementIds: computeDefaultSelection(state.ui.layoutMode, nextPage) },
      }));
    },
    setSelectedElementIds: (selectedElementIds) => {
      set((state) => ({ ui: { ...state.ui, selectedElementIds } }));
    },
    setActiveTool: (activeTool) => {
      set((state) => ({ ui: { ...state.ui, activeTool } }));
    },
    setLayoutMode: (layoutMode) => {
      const state = get();
      const activePage = state.document.pages.find((page) => page.id === state.ui.activePageId);
      set((current) => ({
        ui: {
          ...current.ui,
          layoutMode,
          // Only force a default selection when entering Simple — Nested keeps whatever
          // was already selected (it has the LayoutTree to reselect the root manually).
          selectedElementIds: layoutMode === 'simple' ? computeDefaultSelection(layoutMode, activePage) : current.ui.selectedElementIds,
        },
      }));
    },
    clearSelection: () => {
      const state = get();
      const activePage = state.document.pages.find((page) => page.id === state.ui.activePageId);
      set((current) => ({
        ui: { ...current.ui, selectedElementIds: computeDefaultSelection(current.ui.layoutMode, activePage) },
      }));
    },
  };
}
