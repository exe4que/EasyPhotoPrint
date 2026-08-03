import { describe, expect, it } from 'vitest';

import type { EPPProjectPage } from '@epp/layout-engine';

import { createUiSlice, type UiSlice } from './uiSlice.js';

function createTestPage(id: string): EPPProjectPage {
  return {
    id,
    pageConfig: { sizePreset: 'A4', orientation: 'portrait', dpi: 300 },
    templateRef: undefined,
    rootNode: { id: `root-of-${id}`, type: 'imageSlot' },
    assignments: {},
  };
}

type StoreState = UiSlice & { document: { pages: EPPProjectPage[] } };

describe('ui slice', () => {
  it('clearSelection falls back to the active page root in Simple mode instead of leaving it unselectable', () => {
    let state: StoreState = {
      ...createUiSlice(
        (updater) => {
          state = { ...state, ...updater(state) } as StoreState;
        },
        () => state,
      ),
      document: { pages: [createTestPage('page-1')] },
    };

    state.setSelectedElementIds(['root-of-page-1']);
    expect(state.ui.selectedElementIds).toEqual(['root-of-page-1']);

    state.clearSelection();
    expect(state.ui.selectedElementIds).toEqual(['root-of-page-1']);
  });

  it('clearSelection empties the selection in Nested mode (LayoutTree can reselect the root)', () => {
    let state: StoreState = {
      ...createUiSlice(
        (updater) => {
          state = { ...state, ...updater(state) } as StoreState;
        },
        () => state,
      ),
      document: { pages: [createTestPage('page-1')] },
    };

    state.setLayoutMode('nested');
    state.setSelectedElementIds(['some-nested-node']);
    state.clearSelection();
    expect(state.ui.selectedElementIds).toEqual([]);
  });

  it('setLayoutMode("simple") defaults the selection to the active page root', () => {
    let state: StoreState = {
      ...createUiSlice(
        (updater) => {
          state = { ...state, ...updater(state) } as StoreState;
        },
        () => state,
      ),
      document: { pages: [createTestPage('page-1')] },
    };

    state.setLayoutMode('nested');
    state.setSelectedElementIds(['some-nested-node']);
    state.setLayoutMode('simple');

    expect(state.ui.selectedElementIds).toEqual(['root-of-page-1']);
  });

  it('setActivePageId selects the new active page root while in Simple mode', () => {
    let state: StoreState = {
      ...createUiSlice(
        (updater) => {
          state = { ...state, ...updater(state) } as StoreState;
        },
        () => state,
      ),
      document: { pages: [createTestPage('page-1'), createTestPage('page-2')] },
    };

    state.setActivePageId('page-2');
    expect(state.ui.selectedElementIds).toEqual(['root-of-page-2']);
  });
});
