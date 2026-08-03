import { describe, expect, it } from 'vitest';

import type { EPPProjectPage, EPPTemplate } from '@epp/layout-engine';

import { assignImageToPage, clearImageFromPage, createDefaultPage, createDocumentSlice, reconcileGridChildren } from './documentSlice.js';

describe('document slice helpers', () => {
  it('allows assigning the same library image to multiple slots on the same page', () => {
    const page: EPPProjectPage = {
      ...createDefaultPage('page-1'),
      assignments: {
        'slot-1': 'image-a',
        'slot-2': 'image-b',
      },
    };

    expect(assignImageToPage(page, 'slot-1', 'image-b')).toEqual({
      'slot-1': 'image-b',
      'slot-2': 'image-b',
    });
  });

  it('swaps images only when the source is another slot on the same page', () => {
    const page: EPPProjectPage = {
      ...createDefaultPage('page-1'),
      assignments: {
        'slot-1': 'image-a',
        'slot-2': 'image-b',
      },
    };

    expect(assignImageToPage(page, 'slot-1', 'image-b', 'page')).toEqual({
      'slot-1': 'image-b',
      'slot-2': 'image-a',
    });
  });

  it('replaces the image when the asset is not assigned elsewhere on the page', () => {
    const page: EPPProjectPage = {
      ...createDefaultPage('page-1'),
      assignments: {
        'slot-1': 'image-a',
      },
    };

    expect(assignImageToPage(page, 'slot-1', 'image-c')).toEqual({
      'slot-1': 'image-c',
    });
  });

  it('removes an assignment from a slot without touching the rest of the page', () => {
    const page: EPPProjectPage = {
      ...createDefaultPage('page-1'),
      assignments: {
        'slot-1': 'image-a',
        'slot-2': 'image-b',
      },
    };

    expect(clearImageFromPage(page, 'slot-1')).toEqual({
      'slot-2': 'image-b',
    });
  });

  it('applies pageConfig per page when a template is applied', () => {
    type StoreState = ReturnType<typeof createDocumentSlice>;
    let state = createDocumentSlice((updater) => {
      state = { ...state, ...updater(state) };
    }, () => state) as StoreState;

    const template: EPPTemplate = {
      schemaVersion: '1.0.0',
      id: 'template-1',
      name: 'Template',
      page: { sizePreset: 'Letter', orientation: 'landscape', dpi: 240 },
      rootNode: {
        id: 'root',
        type: 'horizontal',
        children: [
          { id: 'slot-1', type: 'imageSlot' },
          { id: 'slot-2', type: 'imageSlot' },
        ],
      },
    };

    state.applyTemplate('page-1', template);
    expect(state.document.pages[0].pageConfig).toEqual(template.page);
    expect(state.document.pages[0].templateRef).toBe('template-1');
  });

  it('reconciles grid children while preserving existing slot ids first', () => {
    expect(
      reconcileGridChildren(
        [
          { id: 'slot-1', type: 'imageSlot' },
          { id: 'slot-2', type: 'imageSlot' },
        ],
        3,
      ).map((node) => node.id),
    ).toEqual(['slot-1', 'slot-2', 'slot-3']);
  });

  it('reuses a simple sequential lastId plus one strategy after shrinking and growing', () => {
    expect(
      reconcileGridChildren(
        [
          { id: 'slot-1', type: 'imageSlot' },
          { id: 'slot-2', type: 'imageSlot' },
        ],
        5,
      ).map((node) => node.id),
    ).toEqual(['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5']);
  });

  it('drops assignments for removed grid slots when resizing the grid', () => {
    type StoreState = ReturnType<typeof createDocumentSlice>;
    let state = createDocumentSlice((updater) => {
      state = { ...state, ...updater(state) };
    }, () => state) as StoreState;

    state.retypeLayoutNode('page-1', 'root-grid', 'grid');
    state.updateGridNodeConfig('page-1', 'root-grid', {
      gridConfig: { rows: 2, columns: 3 },
    });
    state.assignImageToSlot('page-1', 'slot-1', 'image-a');
    state.assignImageToSlot('page-1', 'slot-6', 'image-b');
    state.updateGridNodeConfig('page-1', 'root-grid', {
      gridConfig: { rows: 1, columns: 2 },
    });

    expect(state.document.pages[0].rootNode.children).toHaveLength(2);
    expect(state.document.pages[0].assignments).toEqual({
      'slot-1': 'image-a',
    });
  });

  it('retypes an image slot into a nested container with child slots', () => {
    type StoreState = ReturnType<typeof createDocumentSlice>;
    let state = createDocumentSlice((updater) => {
      state = { ...state, ...updater(state) };
    }, () => state) as StoreState;

    state.assignImageToSlot('page-1', 'root-grid', 'image-a');
    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');

    const page = state.document.pages[0];
    expect(page.rootNode.type).toBe('horizontal');
    expect(page.rootNode.children).toHaveLength(2);
    expect(page.assignments).not.toHaveProperty('root-grid');
  });

  it('adds a nested child node into a horizontal container', () => {
    type StoreState = ReturnType<typeof createDocumentSlice>;
    let state = createDocumentSlice((updater) => {
      state = { ...state, ...updater(state) };
    }, () => state) as StoreState;

    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    state.addNestedChildNode('page-1', 'root-grid', 'imageSlot');

    expect(state.document.pages[0].rootNode.children).toHaveLength(3);
  });

  it('sets the child slot count of a horizontal/vertical container, preserving existing assignments', () => {
    type StoreState = ReturnType<typeof createDocumentSlice>;
    let state = createDocumentSlice((updater) => {
      state = { ...state, ...updater(state) };
    }, () => state) as StoreState;

    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    state.assignImageToSlot('page-1', 'slot-1', 'image-a');
    state.setContainerChildCount('page-1', 'root-grid', 4);

    expect(state.document.pages[0].rootNode.children).toHaveLength(4);
    expect(state.document.pages[0].assignments).toEqual({ 'slot-1': 'image-a' });

    state.setContainerChildCount('page-1', 'root-grid', 1);
    expect(state.document.pages[0].rootNode.children).toHaveLength(1);
    expect(state.document.pages[0].assignments).toEqual({ 'slot-1': 'image-a' });
  });

  it('removes nested nodes and clears assignments for removed slot ids', () => {
    type StoreState = ReturnType<typeof createDocumentSlice>;
    let state = createDocumentSlice((updater) => {
      state = { ...state, ...updater(state) };
    }, () => state) as StoreState;

    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    state.assignImageToSlot('page-1', 'slot-2', 'image-a');
    state.removeLayoutNode('page-1', 'slot-2');

    expect(state.document.pages[0].rootNode.children?.some((child) => child.id === 'slot-2')).toBe(false);
    expect(state.document.pages[0].assignments).toEqual({});
  });

  it('switches the Simple root type to freeformCanvas and clears slot assignments', () => {
    type StoreState = ReturnType<typeof createDocumentSlice>;
    let state = createDocumentSlice((updater) => {
      state = { ...state, ...updater(state) };
    }, () => state) as StoreState;

    state.assignImageToSlot('page-1', 'root-grid', 'image-a');
    state.setSimpleRootType('page-1', 'freeformCanvas');

    const page = state.document.pages[0];
    expect(page.rootNode.type).toBe('freeformCanvas');
    expect(page.rootNode.freeformElements).toEqual([]);
    expect(page.assignments).toEqual({});

    state.setSimpleRootType('page-1', 'imageSlot');
    expect(state.document.pages[0].rootNode.type).toBe('imageSlot');
  });

  it('starts new pages in simple mode as a root image slot', () => {
    const page = createDefaultPage('page-1');
    expect(page.rootNode.type).toBe('imageSlot');
    expect(page.rootNode.id).toBe('root-grid');
  });
});
