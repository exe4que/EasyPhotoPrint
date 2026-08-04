import { describe, expect, it } from 'vitest';

import type { EPPProjectPage, EPPTemplate, ImageAsset } from '@epp/layout-engine';

import { assignImageToPage, clearImageFromPage, createDefaultPage, createDocumentSlice, reconcileGridChildren } from './documentSlice.js';

type StoreState = ReturnType<typeof createDocumentSlice>;

/**
 * `createDocumentSlice`'s actions mutate a `state` variable captured by the `set`/`get`
 * closures passed into it — reading `.document` off of whatever object this function *returns*
 * would just see a stale snapshot from construction time. The Proxy re-reads every property
 * (data and methods alike) from the live internal state on each access, so callers can keep
 * doing `store.someAction(...)` followed by `store.document...` naturally, same as the original
 * per-test `let state = createDocumentSlice(...)` pattern this replaces.
 */
function createTestStore(imagePool: ImageAsset[] = []): StoreState {
  let internalState = createDocumentSlice(
    (updater) => {
      internalState = { ...internalState, ...updater(internalState as never) } as StoreState;
    },
    () => ({ document: internalState.document, imagePool }) as never,
  ) as StoreState;

  return new Proxy({} as StoreState, {
    get(_target, prop) {
      const value = (internalState as never)[prop as never];
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(internalState) : value;
    },
  });
}

function createTestAsset(id: string, widthPx: number, heightPx: number): ImageAsset {
  return {
    id,
    originalPath: `/tmp/${id}.jpg`,
    storedPath: `/tmp/${id}.jpg`,
    fileName: `${id}.jpg`,
    widthPx,
    heightPx,
    thumbnailDataUrl: 'data:image/jpeg;base64,AA==',
  };
}

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

  it('swaps two assigned slots when assignImageToSlot is called with a page source', () => {
    const state = createTestStore();

    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    state.assignImageToSlot('page-1', 'slot-1', 'image-a');
    state.assignImageToSlot('page-1', 'slot-2', 'image-b');

    // Simulates dragging slot-1's image onto slot-2.
    state.assignImageToSlot('page-1', 'slot-2', 'image-a', 'page');

    expect(state.document.pages[0].assignments).toEqual({
      'slot-1': 'image-b',
      'slot-2': 'image-a',
    });
  });

  it('moves an assigned slot image onto an empty slot when assignImageToSlot is called with a page source', () => {
    const state = createTestStore();

    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    state.assignImageToSlot('page-1', 'slot-1', 'image-a');

    // Simulates dragging slot-1's image onto the empty slot-2.
    state.assignImageToSlot('page-1', 'slot-2', 'image-a', 'page');

    expect(state.document.pages[0].assignments).toEqual({
      'slot-2': 'image-a',
    });
  });

  it('replaces rather than swaps when assignImageToSlot is called with the default library source', () => {
    const state = createTestStore();

    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    state.assignImageToSlot('page-1', 'slot-1', 'image-a');
    state.assignImageToSlot('page-1', 'slot-2', 'image-b');

    // Simulates dragging image-a from the Image Library panel onto slot-2, even though image-a
    // is already assigned to slot-1 on this page — a library drag must never swap.
    state.assignImageToSlot('page-1', 'slot-2', 'image-a');

    expect(state.document.pages[0].assignments).toEqual({
      'slot-1': 'image-a',
      'slot-2': 'image-a',
    });
  });

  it('applies pageConfig per page when a template is applied', () => {
    const state = createTestStore();

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

  it('links a page to a newly saved template so "Save" can overwrite it afterwards', () => {
    const state = createTestStore();

    expect(state.document.pages[0].templateRef).toBeUndefined();
    state.linkPageToTemplate('page-1', 'template-42');
    expect(state.document.pages[0].templateRef).toBe('template-42');
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
    const state = createTestStore();

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
    const state = createTestStore();

    state.assignImageToSlot('page-1', 'root-grid', 'image-a');
    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');

    const page = state.document.pages[0];
    expect(page.rootNode.type).toBe('horizontal');
    expect(page.rootNode.children).toHaveLength(2);
    expect(page.assignments).not.toHaveProperty('root-grid');
  });

  it('adds a nested child node into a horizontal container', () => {
    const state = createTestStore();

    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    state.addNestedChildNode('page-1', 'root-grid', 'imageSlot');

    expect(state.document.pages[0].rootNode.children).toHaveLength(3);
  });

  it('sets the child slot count of a horizontal/vertical container, preserving existing assignments', () => {
    const state = createTestStore();

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
    const state = createTestStore();

    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    state.assignImageToSlot('page-1', 'slot-2', 'image-a');
    state.removeLayoutNode('page-1', 'slot-2');

    expect(state.document.pages[0].rootNode.children?.some((child) => child.id === 'slot-2')).toBe(false);
    expect(state.document.pages[0].assignments).toEqual({});
  });

  it('switches the Simple root type to freeformCanvas and clears slot assignments', () => {
    const state = createTestStore();

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

  it('adds a freeform element centered in the node, referencing a new imageSlot child', () => {
    const state = createTestStore();

    state.setSimpleRootType('page-1', 'freeformCanvas');
    state.addFreeformElement('page-1', 'root-grid', 'image-a');

    const page = state.document.pages[0];
    expect(page.rootNode.freeformElements).toHaveLength(1);
    expect(page.rootNode.children).toHaveLength(1);

    const element = page.rootNode.freeformElements![0];
    expect(page.rootNode.children![0].id).toBe(element.imageNodeId);
    expect(page.rootNode.children![0].type).toBe('imageSlot');
    expect(page.assignments[element.imageNodeId]).toBe('image-a');
    expect(element.transform.widthMm).toBeGreaterThan(0);
    expect(element.transform.rotationDeg).toBe(0);
  });

  it('removes a freeform element along with its imageSlot child and assignment', () => {
    const state = createTestStore();

    state.setSimpleRootType('page-1', 'freeformCanvas');
    state.addFreeformElement('page-1', 'root-grid', 'image-a');
    const elementId = state.document.pages[0].rootNode.freeformElements![0].id;

    state.removeFreeformElement('page-1', 'root-grid', elementId);

    const page = state.document.pages[0];
    expect(page.rootNode.freeformElements).toEqual([]);
    expect(page.rootNode.children).toEqual([]);
    expect(page.assignments).toEqual({});
  });

  it('clamps updateFreeformElementTransform so the element cannot be dragged fully outside the node', () => {
    const state = createTestStore();

    state.setSimpleRootType('page-1', 'freeformCanvas');
    state.addFreeformElement('page-1', 'root-grid', 'image-a');
    const elementId = state.document.pages[0].rootNode.freeformElements![0].id;

    state.updateFreeformElementTransform('page-1', 'root-grid', elementId, { xMm: 100000, yMm: 100000 });

    const element = state.document.pages[0].rootNode.freeformElements![0];
    // A4 is ~210mm wide — an element dragged to xMm=100000 must be clamped back near the
    // node's edge, never left free to fly off completely (§4.2 containment requirement).
    expect(element.transform.xMm).toBeLessThan(300);
    expect(element.transform.yMm).toBeLessThan(400);
  });

  it('derives the height from the width and the assigned image aspect ratio when only width is set', () => {
    const state = createTestStore([createTestAsset('image-a', 400, 200)]);
    state.assignImageToSlot('page-1', 'root-grid', 'image-a');

    state.setSlotSpecificSize('page-1', 'root-grid', 'width', 100);

    const slot = state.document.pages[0].rootNode;
    expect(slot.imageSlotConfig?.scalingRule).toBe('specificSize');
    expect(slot.imageSlotConfig?.specificSizeMm).toEqual({ widthMm: 100, heightMm: 50, lockedAxis: 'width' });
  });

  it('derives the width from the height when only height is set', () => {
    const state = createTestStore([createTestAsset('image-a', 400, 200)]);
    state.assignImageToSlot('page-1', 'root-grid', 'image-a');

    state.setSlotSpecificSize('page-1', 'root-grid', 'height', 60);

    expect(state.document.pages[0].rootNode.imageSlotConfig?.specificSizeMm).toEqual({
      widthMm: 120,
      heightMm: 60,
      lockedAxis: 'height',
    });
  });

  it('locks both axes (stretch) once the user sets both explicitly', () => {
    const state = createTestStore([createTestAsset('image-a', 400, 200)]);
    state.assignImageToSlot('page-1', 'root-grid', 'image-a');

    state.setSlotSpecificSize('page-1', 'root-grid', 'width', 100);
    state.setSlotSpecificSize('page-1', 'root-grid', 'height', 90);

    expect(state.document.pages[0].rootNode.imageSlotConfig?.specificSizeMm).toEqual({
      widthMm: 100,
      heightMm: 90,
      lockedAxis: 'both',
    });
  });

  it('clearing the only locked axis removes the specific size entirely', () => {
    const state = createTestStore([createTestAsset('image-a', 400, 200)]);
    state.assignImageToSlot('page-1', 'root-grid', 'image-a');
    state.setSlotSpecificSize('page-1', 'root-grid', 'width', 100);

    state.setSlotSpecificSize('page-1', 'root-grid', 'width', null);

    expect(state.document.pages[0].rootNode.imageSlotConfig?.specificSizeMm).toBeUndefined();
  });

  it('re-derives the non-locked axis when the assigned image changes', () => {
    const state = createTestStore([createTestAsset('image-a', 400, 200), createTestAsset('image-b', 100, 400)]);
    state.assignImageToSlot('page-1', 'root-grid', 'image-a');
    state.setSlotSpecificSize('page-1', 'root-grid', 'width', 100);
    expect(state.document.pages[0].rootNode.imageSlotConfig?.specificSizeMm?.heightMm).toBe(50);

    state.assignImageToSlot('page-1', 'root-grid', 'image-b');

    const specificSizeMm = state.document.pages[0].rootNode.imageSlotConfig?.specificSizeMm;
    expect(specificSizeMm?.widthMm).toBe(100);
    expect(specificSizeMm?.heightMm).toBe(400);
  });

  it('grows a slot to its specific size by shrinking its adjacent sibling, right when the size is set', () => {
    const state = createTestStore([createTestAsset('image-a', 100, 100)]);
    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    // Root A4 portrait is 210mm wide minus 10mm padding minus a 3mm gap -> ~197mm split 50/50 (~97mm each).
    const [firstChildId] = state.document.pages[0].rootNode.children!.map((child) => child.id);
    state.assignImageToSlot('page-1', firstChildId, 'image-a');

    state.setSlotSpecificSize('page-1', firstChildId, 'width', 150);

    const [firstChild, secondChild] = state.document.pages[0].rootNode.children!;
    const totalRatio = (firstChild.sizeRatio ?? 1) + (secondChild.sizeRatio ?? 1);
    const availableMain = 210 - 10 - 3; // page width - root padding (5+5) - gap
    const firstChildWidthMm = ((firstChild.sizeRatio ?? 1) / totalRatio) * availableMain;
    expect(firstChildWidthMm).toBeCloseTo(150, 1);
  });
});
