import { isSimpleModeCompatible, type EPPProjectPage } from '@epp/layout-engine';

export interface UiState {
  activePageId: string;
  selectedElementIds: string[];
  activeTool: 'select' | 'pan' | 'crop';
  layoutMode: 'simple' | 'nested';
  viewMode: 'editor' | 'preview';
}

export interface UiSlice {
  ui: UiState;
  setActivePageId: (pageId: string) => void;
  setSelectedElementIds: (ids: string[]) => void;
  setActiveTool: (tool: UiState['activeTool']) => void;
  setLayoutMode: (mode: UiState['layoutMode']) => void;
  setViewMode: (mode: UiState['viewMode']) => void;
  clearSelection: () => void;
}

export function createInitialUiState(): UiState {
  return {
    activePageId: 'page-1',
    selectedElementIds: [],
    activeTool: 'select',
    layoutMode: 'simple',
    viewMode: 'editor',
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

/**
 * Computes the full `ui` patch for activating a given page: the layout mode always follows the
 * newly active page's own structure (see page-navigation spec) rather than persisting whatever
 * mode the previous page was in. Exported so cross-slice actions (e.g. addPage/removePage in
 * store/index.ts) can fold this into their own single `set()` call instead of calling
 * `setActivePageId` as a second, separately-tracked `set()` — zundo pushes one history entry per
 * `set()` call regardless of whether the tracked slice changed, so two calls would fragment one
 * logical action into two undo steps.
 */
export function computeActivePageUi(currentUi: UiState, activePageId: string, nextPage: EPPProjectPage | undefined): UiState {
  const layoutMode = nextPage
    ? isSimpleModeCompatible(nextPage.rootNode)
      ? 'simple'
      : 'nested'
    : currentUi.layoutMode;
  return {
    ...currentUi,
    activePageId,
    layoutMode,
    selectedElementIds: computeDefaultSelection(layoutMode, nextPage),
  };
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
      set((state) => ({ ui: computeActivePageUi(state.ui, activePageId, nextPage) }));
    },
    setSelectedElementIds: (selectedElementIds) => {
      set((state) => ({ ui: { ...state.ui, selectedElementIds } }));
    },
    setActiveTool: (activeTool) => {
      set((state) => ({ ui: { ...state.ui, activeTool } }));
    },
    setViewMode: (viewMode) => {
      set((state) => ({ ui: { ...state.ui, viewMode } }));
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
