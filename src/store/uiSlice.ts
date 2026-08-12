import { isSimpleModeCompatible, type EPPProjectPage } from '@epp/layout-engine';

/** At most one thing selected app-wide: a layout node, or an Image Library asset -- never both. */
export type Selection = { kind: 'node'; id: string } | { kind: 'image'; id: string } | null;

export interface UiState {
  activePageId: string;
  selection: Selection;
  activeTool: 'select' | 'pan' | 'crop';
  layoutMode: 'simple' | 'nested';
  viewMode: 'editor' | 'preview';
  /** See the `processing-overlay` capability: set while adding images to the library, exporting to
   * PDF, or printing, and read by the app-root-mounted `ProcessingOverlay` to block the whole app. */
  processingOverlay: { visible: boolean };
}

export interface UiSlice {
  ui: UiState;
  setActivePageId: (pageId: string) => void;
  setSelection: (selection: Selection) => void;
  setActiveTool: (tool: UiState['activeTool']) => void;
  setLayoutMode: (mode: UiState['layoutMode']) => void;
  setViewMode: (mode: UiState['viewMode']) => void;
  clearSelection: () => void;
  showProcessingOverlay: () => void;
  hideProcessingOverlay: () => void;
}

export function createInitialUiState(): UiState {
  return {
    activePageId: 'page-1',
    selection: null,
    activeTool: 'select',
    layoutMode: 'simple',
    viewMode: 'editor',
    processingOverlay: { visible: false },
  };
}

interface UiSliceDependencies {
  ui: UiState;
  document: { pages: EPPProjectPage[] };
}

/**
 * Entering Simple mode, or navigating to a page that's already in Simple mode, defaults the
 * selection to that page's root -- there's no LayoutTree to reselect it from by hand the way
 * Nested mode has, and this is also what puts the canvas's own selection ring on the root
 * immediately instead of requiring a click first. `clearSelection` itself no longer uses this:
 * see its own comment.
 */
function computeDefaultSelection(layoutMode: UiState['layoutMode'], page: EPPProjectPage | undefined): Selection {
  return layoutMode === 'simple' && page ? { kind: 'node', id: page.rootNode.id } : null;
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
    selection: computeDefaultSelection(layoutMode, nextPage),
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
    setSelection: (selection) => {
      set((state) => ({ ui: { ...state.ui, selection } }));
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
          selection: layoutMode === 'simple' ? computeDefaultSelection(layoutMode, activePage) : current.ui.selection,
        },
      }));
    },
    clearSelection: () => {
      // Always nulls, in both modes -- previously fell back to the active page's root in Simple
      // mode (matching computeDefaultSelection, above), which meant a deselect action on a page
      // whose only slot is its own root produced the exact same non-null value that a fresh
      // explicit selection would, making the two indistinguishable to anything reacting to
      // `ui.selection` (e.g. a mobile bottom sheet driven by "selection went from null to
      // something" -- see the mobile-shell capability). `PropertiesPanel` already has its own
      // `selectedNode ?? activePage.rootNode` fallback for a null selection, so desktop's
      // sidebar content is unaffected; only the canvas's selection ring on the root no longer
      // persists through an explicit deselect click in Simple mode.
      set((current) => ({ ui: { ...current.ui, selection: null } }));
    },
    showProcessingOverlay: () => {
      set((current) => ({ ui: { ...current.ui, processingOverlay: { visible: true } } }));
    },
    hideProcessingOverlay: () => {
      set((current) => ({ ui: { ...current.ui, processingOverlay: { visible: false } } }));
    },
  };
}
