import { describe, expect, it } from 'vitest';

import type { EPPProjectPage } from '@epp/layout-engine';

import { createUiSlice, type UiSlice } from './uiSlice.js';

function createTestPage(id: string): EPPProjectPage {
  return {
    id,
    pageConfig: { orientation: 'portrait', dpi: 300 },
    templateRef: undefined,
    rootNode: { id: `root-of-${id}`, type: 'imageSlot' },
    assignments: {},
  };
}

type StoreState = UiSlice & { document: { pages: EPPProjectPage[] } };

describe('ui slice', () => {
  it('clearSelection empties the selection in Simple mode too (not the active page root)', () => {
    let state: StoreState = {
      ...createUiSlice(
        (updater) => {
          state = { ...state, ...updater(state) } as StoreState;
        },
        () => state,
      ),
      document: { pages: [createTestPage('page-1')] },
    };

    state.setSelection({ kind: 'node', id: 'root-of-page-1' });
    expect(state.ui.selection).toEqual({ kind: 'node', id: 'root-of-page-1' });

    state.clearSelection();
    expect(state.ui.selection).toBeNull();
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
    state.setSelection({ kind: 'node', id: 'some-nested-node' });
    state.clearSelection();
    expect(state.ui.selection).toBeNull();
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
    state.setSelection({ kind: 'node', id: 'some-nested-node' });
    state.setLayoutMode('simple');

    expect(state.ui.selection).toEqual({ kind: 'node', id: 'root-of-page-1' });
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
    expect(state.ui.selection).toEqual({ kind: 'node', id: 'root-of-page-2' });
  });

  it("setActivePageId derives the layout mode from the newly active page's structure", () => {
    const nestedPage: EPPProjectPage = {
      id: 'nested-page',
      pageConfig: { orientation: 'portrait', dpi: 300 },
      templateRef: undefined,
      rootNode: {
        id: 'nested-root',
        type: 'horizontal',
        children: [{ id: 'inner-container', type: 'vertical', children: [] }],
      },
      assignments: {},
    };

    let state: StoreState = {
      ...createUiSlice(
        (updater) => {
          state = { ...state, ...updater(state) } as StoreState;
        },
        () => state,
      ),
      document: { pages: [createTestPage('page-1'), nestedPage] },
    };

    state.setActivePageId('nested-page');
    expect(state.ui.layoutMode).toBe('nested');
    expect(state.ui.selection).toBeNull();

    state.setActivePageId('page-1');
    expect(state.ui.layoutMode).toBe('simple');
    expect(state.ui.selection).toEqual({ kind: 'node', id: 'root-of-page-1' });
  });

  it('viewMode defaults to editor and setViewMode toggles it without touching other ui state', () => {
    let state: StoreState = {
      ...createUiSlice(
        (updater) => {
          state = { ...state, ...updater(state) } as StoreState;
        },
        () => state,
      ),
      document: { pages: [createTestPage('page-1')] },
    };

    expect(state.ui.viewMode).toBe('editor');

    state.setSelection({ kind: 'node', id: 'root-of-page-1' });
    state.setViewMode('preview');
    expect(state.ui.viewMode).toBe('preview');
    expect(state.ui.selection).toEqual({ kind: 'node', id: 'root-of-page-1' });
    expect(state.ui.activePageId).toBe('page-1');

    state.setViewMode('editor');
    expect(state.ui.viewMode).toBe('editor');
  });

  it('setActivePageId keeps the current layout mode when the target id does not resolve to a page', () => {
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
    state.setActivePageId('missing-page');

    expect(state.ui.layoutMode).toBe('nested');
  });

  it('selecting an image clears a previously selected node, and vice versa (at most one selection at a time)', () => {
    let state: StoreState = {
      ...createUiSlice(
        (updater) => {
          state = { ...state, ...updater(state) } as StoreState;
        },
        () => state,
      ),
      document: { pages: [createTestPage('page-1')] },
    };

    state.setSelection({ kind: 'node', id: 'root-of-page-1' });
    expect(state.ui.selection).toEqual({ kind: 'node', id: 'root-of-page-1' });

    state.setSelection({ kind: 'image', id: 'asset-1' });
    expect(state.ui.selection).toEqual({ kind: 'image', id: 'asset-1' });

    state.setSelection({ kind: 'node', id: 'root-of-page-1' });
    expect(state.ui.selection).toEqual({ kind: 'node', id: 'root-of-page-1' });
  });
});
