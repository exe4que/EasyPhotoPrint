import { describe, expect, it } from 'vitest';

import type { EPPProjectPage, EPPTemplate, ImageAsset } from '@epp/layout-engine';

import {
  assignImageToPage,
  captureSlotProperties,
  clearImageFromPage,
  createDefaultPage,
  createDocumentSlice,
  reconcileGridChildren,
  type CopiedSlotProperties,
} from './documentSlice.js';

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

  it('replaces rather than swapping when the image is already assigned to another slot on the page', () => {
    const state = createTestStore();

    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    state.assignImageToSlot('page-1', 'slot-1', 'image-a');
    state.assignImageToSlot('page-1', 'slot-2', 'image-b');

    // Assigning image-a to slot-2 (e.g. from the Image Library) never swaps or clears slot-1.
    state.assignImageToSlot('page-1', 'slot-2', 'image-a');

    expect(state.document.pages[0].assignments).toEqual({
      'slot-1': 'image-a',
      'slot-2': 'image-a',
    });
  });

  it('applies orientation/dpi per page when a template is applied, leaving the document sheet size untouched', () => {
    const state = createTestStore();
    const sheetSizeBefore = state.document.sheetSize;

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
    expect(state.document.pages[0].pageConfig).toEqual({ orientation: 'landscape', dpi: 240 });
    expect(state.document.pages[0].templateRef).toBe('template-1');
    expect(state.document.sheetSize).toEqual(sheetSizeBefore);
  });

  it('links a page to a newly saved template so "Save" can overwrite it afterwards', () => {
    const state = createTestStore();

    expect(state.document.pages[0].templateRef).toBeUndefined();
    state.linkPageToTemplate('page-1', 'template-42');
    expect(state.document.pages[0].templateRef).toBe('template-42');
  });

  it('exportTemplate snapshots the document sheet size and the exporting page orientation/dpi', () => {
    const state = createTestStore();

    state.updateSheetSize({ sizePreset: 'A3' });
    state.updatePageConfig('page-1', { orientation: 'landscape', dpi: 150 });

    const exported = state.exportTemplate('page-1');
    expect(exported.page).toEqual({ sizePreset: 'A3', customSizeMm: undefined, orientation: 'landscape', dpi: 150 });
  });

  it('updateSheetSize changes the single document-level sheet size', () => {
    const state = createTestStore();

    state.updateSheetSize({ sizePreset: 'Letter' });
    expect(state.document.sheetSize).toEqual({ sizePreset: 'Letter' });

    state.updateSheetSize({ sizePreset: 'Custom', customSizeMm: { widthMm: 100, heightMm: 150 } });
    expect(state.document.sheetSize).toEqual({ sizePreset: 'Custom', customSizeMm: { widthMm: 100, heightMm: 150 } });
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

  it('retypes the root to freeformCanvas and clears slot assignments', () => {
    const state = createTestStore();

    state.assignImageToSlot('page-1', 'root-grid', 'image-a');
    state.retypeLayoutNode('page-1', 'root-grid', 'freeformCanvas');

    const page = state.document.pages[0];
    expect(page.rootNode.type).toBe('freeformCanvas');
    expect(page.rootNode.freeformElements).toEqual([]);
    expect(page.assignments).toEqual({});

    state.retypeLayoutNode('page-1', 'root-grid', 'imageSlot');
    expect(state.document.pages[0].rootNode.type).toBe('imageSlot');
  });

  it('starts new pages in simple mode as a root image slot', () => {
    const page = createDefaultPage('page-1');
    expect(page.rootNode.type).toBe('imageSlot');
    expect(page.rootNode.id).toBe('root-grid');
  });

  it('adds a freeform element centered in the node, referencing a new imageSlot child', () => {
    const state = createTestStore();

    state.retypeLayoutNode('page-1', 'root-grid', 'freeformCanvas');
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

  it('does not collide the shadow imageSlot id with the freeformCanvas node id when the retyped node held the highest slot number', () => {
    const state = createTestStore();

    // A 2x3 grid numbers its children slot-1..slot-6. Retyping the *last* one drops it out of
    // the imageSlot id count, so a naive next-id generator would reissue "slot-6" for the new
    // shadow slot -- colliding with the freeformCanvas node's own (unchanged) id.
    state.retypeLayoutNode('page-1', 'root-grid', 'grid');
    state.updateGridNodeConfig('page-1', 'root-grid', { gridConfig: { rows: 2, columns: 3 } });
    const lastChildId = state.document.pages[0].rootNode.children![5].id;
    expect(lastChildId).toBe('slot-6');

    state.retypeLayoutNode('page-1', lastChildId, 'freeformCanvas');
    state.addFreeformElement('page-1', lastChildId, 'image-a');

    const freeformNode = state.document.pages[0].rootNode.children!.find((child) => child.id === lastChildId)!;
    const shadowSlotId = freeformNode.children![0].id;

    expect(shadowSlotId).not.toBe(lastChildId);
    expect(state.document.pages[0].assignments[shadowSlotId]).toBe('image-a');
    expect(state.document.pages[0].assignments[lastChildId]).toBeUndefined();
  });

  it('removes a freeform element along with its imageSlot child and assignment', () => {
    const state = createTestStore();

    state.retypeLayoutNode('page-1', 'root-grid', 'freeformCanvas');
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

    state.retypeLayoutNode('page-1', 'root-grid', 'freeformCanvas');
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

  it('cycles imageRotationDeg through 0 -> 90 -> 180 -> 270 -> 0 without touching the slot box/shape', () => {
    const state = createTestStore();
    const rootBefore = state.document.pages[0].rootNode;

    expect(rootBefore.imageSlotConfig?.imageRotationDeg).toBeUndefined();

    state.rotateSlotImage('page-1', 'root-grid');
    expect(state.document.pages[0].rootNode.imageSlotConfig?.imageRotationDeg).toBe(90);

    state.rotateSlotImage('page-1', 'root-grid');
    expect(state.document.pages[0].rootNode.imageSlotConfig?.imageRotationDeg).toBe(180);

    state.rotateSlotImage('page-1', 'root-grid');
    expect(state.document.pages[0].rootNode.imageSlotConfig?.imageRotationDeg).toBe(270);

    state.rotateSlotImage('page-1', 'root-grid');
    const rootAfter = state.document.pages[0].rootNode;
    expect(rootAfter.imageSlotConfig?.imageRotationDeg).toBe(0);

    // Rotation only touches imageSlotConfig -- the node's own shape/type/id is untouched.
    expect(rootAfter.id).toBe(rootBefore.id);
    expect(rootAfter.type).toBe(rootBefore.type);
    expect(rootAfter.paddingMm).toEqual(rootBefore.paddingMm);
  });

  it('rotating an imageSlot preserves its other imageSlotConfig fields', () => {
    const state = createTestStore([createTestAsset('image-a', 400, 200)]);
    state.assignImageToSlot('page-1', 'root-grid', 'image-a');
    state.setSlotSpecificSize('page-1', 'root-grid', 'width', 100);

    state.rotateSlotImage('page-1', 'root-grid');

    const imageSlotConfig = state.document.pages[0].rootNode.imageSlotConfig;
    expect(imageSlotConfig?.imageRotationDeg).toBe(90);
    expect(imageSlotConfig?.scalingRule).toBe('specificSize');
    expect(imageSlotConfig?.specificSizeMm).toEqual({ widthMm: 100, heightMm: 50, lockedAxis: 'width' });
  });

  it('derives the non-locked specificSize axis using the rotated (effective, inverted) aspect ratio, not the raw one', () => {
    const state = createTestStore([createTestAsset('image-a', 400, 200)]); // raw aspect 2 (landscape)
    state.assignImageToSlot('page-1', 'root-grid', 'image-a');
    state.rotateSlotImage('page-1', 'root-grid'); // 90deg -> effective on-screen aspect is 1/2 = 0.5

    state.setSlotSpecificSize('page-1', 'root-grid', 'width', 100);

    // Using the raw (unrotated) aspect ratio would derive heightMm = 100 / 2 = 50 -- wrong, since
    // specificSizeMm is always the on-screen size and the image now displays at aspect 0.5.
    expect(state.document.pages[0].rootNode.imageSlotConfig?.specificSizeMm).toEqual({
      widthMm: 100,
      heightMm: 200,
      lockedAxis: 'width',
    });
  });

  it('re-derives the non-locked axis using the rotated aspect ratio when the assigned image changes on a rotated slot', () => {
    const state = createTestStore([createTestAsset('image-a', 400, 200), createTestAsset('image-b', 100, 400)]);
    state.assignImageToSlot('page-1', 'root-grid', 'image-a');
    state.rotateSlotImage('page-1', 'root-grid');
    state.setSlotSpecificSize('page-1', 'root-grid', 'width', 100);
    expect(state.document.pages[0].rootNode.imageSlotConfig?.specificSizeMm?.heightMm).toBe(200);

    // image-b: raw aspect 0.25 (portrait), effective (rotated) aspect 4.
    state.assignImageToSlot('page-1', 'root-grid', 'image-b');

    const specificSizeMm = state.document.pages[0].rootNode.imageSlotConfig?.specificSizeMm;
    expect(specificSizeMm?.widthMm).toBe(100);
    expect(specificSizeMm?.heightMm).toBe(25);
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

describe('captureSlotProperties', () => {
  it('normalizes missing scaling rule, rotation, and padding to their displayed defaults', () => {
    const node = createDefaultPage('page-1').rootNode; // fresh imageSlot: no rotation, no explicit padding beyond the default
    node.paddingMm = undefined;

    expect(captureSlotProperties(node, undefined)).toEqual({
      imageAssetId: null,
      scalingRule: 'fitInParent',
      imageRotationDeg: 0,
      paddingMm: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });

  it('captures an explicitly configured slot as-is', () => {
    const node = {
      ...createDefaultPage('page-1').rootNode,
      imageSlotConfig: { scalingRule: 'envelopeParent' as const, imageRotationDeg: 90 as const },
      paddingMm: { top: 1, right: 2, bottom: 3, left: 4 },
    };

    expect(captureSlotProperties(node, 'image-a')).toEqual({
      imageAssetId: 'image-a',
      scalingRule: 'envelopeParent',
      imageRotationDeg: 90,
      paddingMm: { top: 1, right: 2, bottom: 3, left: 4 },
    });
  });

  it('captures specificSizeMm when the scaling rule is specificSize', () => {
    const node = {
      ...createDefaultPage('page-1').rootNode,
      imageSlotConfig: {
        scalingRule: 'specificSize' as const,
        imageRotationDeg: 0 as const,
        specificSizeMm: { widthMm: 100, heightMm: 50, lockedAxis: 'width' as const },
      },
    };

    expect(captureSlotProperties(node, 'image-a').specificSizeMm).toEqual({
      widthMm: 100,
      heightMm: 50,
      lockedAxis: 'width',
    });
  });

  it('omits specificSizeMm when the scaling rule is not specificSize, even if stale specificSizeMm data is present', () => {
    const node = {
      ...createDefaultPage('page-1').rootNode,
      imageSlotConfig: {
        scalingRule: 'stretch' as const,
        imageRotationDeg: 0 as const,
        specificSizeMm: { widthMm: 100, heightMm: 50, lockedAxis: 'width' as const },
      },
    };

    expect(captureSlotProperties(node, 'image-a').specificSizeMm).toBeUndefined();
  });
});

describe('applySlotProperties', () => {
  const properties: CopiedSlotProperties = {
    imageAssetId: 'image-a',
    scalingRule: 'stretch',
    imageRotationDeg: 180,
    paddingMm: { top: 9, right: 9, bottom: 9, left: 9 },
    specificSizeMm: undefined,
  };

  it('overwrites every target imageSlot\'s image, scaling rule, rotation, and padding in one pass', () => {
    const state = createTestStore();
    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    const [slot1, slot2] = state.document.pages[0].rootNode.children!.map((child) => child.id);

    state.applySlotProperties('page-1', properties, [slot1, slot2]);

    const [nextSlot1, nextSlot2] = state.document.pages[0].rootNode.children!;
    for (const slot of [nextSlot1, nextSlot2]) {
      expect(slot.imageSlotConfig?.scalingRule).toBe('stretch');
      expect(slot.imageSlotConfig?.imageRotationDeg).toBe(180);
      expect(slot.paddingMm).toEqual({ top: 9, right: 9, bottom: 9, left: 9 });
    }
    expect(state.document.pages[0].assignments).toEqual({ [slot1]: 'image-a', [slot2]: 'image-a' });
  });

  it('clears the assignment on targets when the copied clipboard had no image', () => {
    const state = createTestStore([createTestAsset('image-a', 100, 100)]);
    state.assignImageToSlot('page-1', 'root-grid', 'image-a');

    state.applySlotProperties('page-1', { ...properties, imageAssetId: null }, ['root-grid']);

    expect(state.document.pages[0].assignments).toEqual({});
  });

  it('is a no-op (no document mutation) when targetNodeIds is empty', () => {
    const state = createTestStore();
    const rootBefore = state.document.pages[0].rootNode;

    state.applySlotProperties('page-1', properties, []);

    expect(state.document.pages[0].rootNode).toBe(rootBefore);
  });

  it('sets the target\'s specificSizeMm when the clipboard entry is specificSize-configured', () => {
    const state = createTestStore();

    state.applySlotProperties(
      'page-1',
      { ...properties, scalingRule: 'specificSize', specificSizeMm: { widthMm: 100, heightMm: 50, lockedAxis: 'width' } },
      ['root-grid'],
    );

    expect(state.document.pages[0].rootNode.imageSlotConfig?.specificSizeMm).toEqual({
      widthMm: 100,
      heightMm: 50,
      lockedAxis: 'width',
    });
  });

  it('clears a stale specificSizeMm on the target when the clipboard entry is not specificSize', () => {
    const state = createTestStore();
    state.updateLayoutNode('page-1', 'root-grid', {
      imageSlotConfig: { scalingRule: 'specificSize', specificSizeMm: { widthMm: 100, heightMm: 50, lockedAxis: 'width' } },
    });

    state.applySlotProperties('page-1', properties, ['root-grid']);

    expect(state.document.pages[0].rootNode.imageSlotConfig?.specificSizeMm).toBeUndefined();
  });
});

describe('copySlotPropertiesToSiblings', () => {
  it('applies the source slot\'s properties to imageSlot siblings only, skipping non-imageSlot siblings', () => {
    const state = createTestStore([createTestAsset('image-a', 100, 100)]);
    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    state.addNestedChildNode('page-1', 'root-grid', 'grid'); // a non-imageSlot sibling
    const [slot1, slot2] = state.document.pages[0].rootNode.children!.map((child) => child.id);
    const gridSiblingId = state.document.pages[0].rootNode.children![2].id;

    state.assignImageToSlot('page-1', slot1, 'image-a');
    state.updateLayoutNode('page-1', slot1, { imageSlotConfig: { scalingRule: 'envelopeParent' } });

    state.copySlotPropertiesToSiblings('page-1', slot1);

    const [nextSlot1, nextSlot2, nextGridSibling] = state.document.pages[0].rootNode.children!;
    expect(nextSlot2.imageSlotConfig?.scalingRule).toBe('envelopeParent');
    expect(state.document.pages[0].assignments[slot2]).toBe('image-a');
    expect(nextGridSibling.type).toBe('grid');
    expect(nextGridSibling.id).toBe(gridSiblingId);
    expect(nextSlot1.id).toBe(slot1);
  });

  it('is a no-op when the selected slot has no imageSlot siblings', () => {
    const state = createTestStore();
    const rootBefore = state.document.pages[0].rootNode;

    state.copySlotPropertiesToSiblings('page-1', 'root-grid'); // root has no parent, so no siblings

    expect(state.document.pages[0].rootNode).toBe(rootBefore);
  });

  it('carries specificSizeMm to imageSlot siblings when the source is specificSize-configured', () => {
    const state = createTestStore([createTestAsset('image-a', 100, 100)]);
    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    const [slot1, slot2] = state.document.pages[0].rootNode.children!.map((child) => child.id);
    state.assignImageToSlot('page-1', slot1, 'image-a');
    state.updateLayoutNode('page-1', slot1, {
      imageSlotConfig: { scalingRule: 'specificSize', specificSizeMm: { widthMm: 40, heightMm: 20, lockedAxis: 'width' } },
    });

    state.copySlotPropertiesToSiblings('page-1', slot1);

    const nextSlot2 = state.document.pages[0].rootNode.children!.find((child) => child.id === slot2);
    expect(nextSlot2?.imageSlotConfig?.specificSizeMm).toEqual({ widthMm: 40, heightMm: 20, lockedAxis: 'width' });
  });
});

describe('copySlotPropertiesToPage', () => {
  it('applies the source slot\'s properties to every imageSlot on the page regardless of nesting', () => {
    const state = createTestStore([createTestAsset('image-a', 100, 100)]);
    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    state.addNestedChildNode('page-1', 'root-grid', 'vertical'); // nested container with its own imageSlot children
    const [slot1, slot2] = state.document.pages[0].rootNode.children!.map((child) => child.id);
    const nestedContainer = state.document.pages[0].rootNode.children![2];
    const [slot3, slot4] = nestedContainer.children!.map((child) => child.id);

    state.assignImageToSlot('page-1', slot1, 'image-a');
    state.rotateSlotImage('page-1', slot1);

    state.copySlotPropertiesToPage('page-1', slot1);

    const page = state.document.pages[0];
    for (const targetId of [slot2, slot3, slot4]) {
      expect(page.assignments[targetId]).toBe('image-a');
    }
    const nestedAfter = page.rootNode.children![2];
    expect(nestedAfter.children!.every((slot) => slot.imageSlotConfig?.imageRotationDeg === 90)).toBe(true);
    expect(page.rootNode.children![1].imageSlotConfig?.imageRotationDeg).toBe(90);
  });

  it('is a no-op when no other imageSlot exists on the page', () => {
    const state = createTestStore();
    const rootBefore = state.document.pages[0].rootNode;

    state.copySlotPropertiesToPage('page-1', 'root-grid');

    expect(state.document.pages[0].rootNode).toBe(rootBefore);
  });

  it('carries specificSizeMm to every imageSlot on the page when the source is specificSize-configured', () => {
    const state = createTestStore([createTestAsset('image-a', 100, 100)]);
    state.retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    const [slot1, slot2] = state.document.pages[0].rootNode.children!.map((child) => child.id);
    state.assignImageToSlot('page-1', slot1, 'image-a');
    state.updateLayoutNode('page-1', slot1, {
      imageSlotConfig: { scalingRule: 'specificSize', specificSizeMm: { widthMm: 40, heightMm: 20, lockedAxis: 'width' } },
    });

    state.copySlotPropertiesToPage('page-1', slot1);

    const nextSlot2 = state.document.pages[0].rootNode.children!.find((child) => child.id === slot2);
    expect(nextSlot2?.imageSlotConfig?.specificSizeMm).toEqual({ widthMm: 40, heightMm: 20, lockedAxis: 'width' });
  });
});
