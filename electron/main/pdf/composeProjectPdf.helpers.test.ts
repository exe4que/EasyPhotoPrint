import type { EPPProjectPage, ImageAsset, LayoutNode, SheetSize } from '@epp/layout-engine';
import { describe, expect, it } from 'vitest';

import { computePagePlacements } from './composeProjectPdf.helpers.js';

const A4: SheetSize = { sizePreset: 'A4' };

function asset(overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    id: 'asset-1',
    originalPath: '/tmp/photo.jpg',
    storedPath: '/tmp/photo.jpg',
    fileName: 'photo.jpg',
    widthPx: 800,
    heightPx: 600,
    thumbnailDataUrl: 'data:image/png;base64,',
    ...overrides,
  };
}

function imageSlotNode(id: string, overrides: Partial<LayoutNode> = {}): LayoutNode {
  return { id, type: 'imageSlot', ...overrides };
}

function page(rootNode: LayoutNode, assignments: Record<string, string> = {}, overrides: Partial<EPPProjectPage> = {}): EPPProjectPage {
  return {
    id: 'page-1',
    pageConfig: { orientation: 'portrait', dpi: 300 },
    rootNode,
    assignments,
    ...overrides,
  };
}

describe('computePagePlacements', () => {
  it('sizes the page from the document sheet size, honoring the page orientation', () => {
    const root = imageSlotNode('root');
    const portrait = computePagePlacements(A4, page(root, {}, { pageConfig: { orientation: 'portrait', dpi: 300 } }), new Map());
    const landscape = computePagePlacements(A4, page(root, {}, { pageConfig: { orientation: 'landscape', dpi: 300 } }), new Map());

    expect(portrait.pageBoxMm).toEqual({ x: 0, y: 0, w: 210, h: 297 });
    expect(landscape.pageBoxMm).toEqual({ x: 0, y: 0, w: 297, h: 210 });
    expect(portrait.dpi).toBe(300);
  });

  it('skips an imageSlot with no assignment', () => {
    const root = imageSlotNode('root');
    const result = computePagePlacements(A4, page(root), new Map());

    expect(result.imageSlots).toHaveLength(0);
  });

  it('skips an imageSlot assigned to a missing asset', () => {
    const root = imageSlotNode('root');
    const assetMap = new Map([['asset-1', asset({ missing: true })]]);
    const result = computePagePlacements(A4, page(root, { root: 'asset-1' }), assetMap);

    expect(result.imageSlots).toHaveLength(0);
  });

  it('includes an assigned imageSlot with its box, scaling rule, and rotation', () => {
    const root = imageSlotNode('root', {
      imageSlotConfig: { scalingRule: 'envelopeParent', imageRotationDeg: 90 },
    });
    const assetMap = new Map([['asset-1', asset()]]);
    const result = computePagePlacements(A4, page(root, { root: 'asset-1' }), assetMap);

    expect(result.imageSlots).toHaveLength(1);
    const placed = result.imageSlots[0];
    expect(placed.boxMm).toEqual({ x: 0, y: 0, w: 210, h: 297 });
    expect(placed.scalingRule).toBe('envelopeParent');
    expect(placed.discreteRotationDeg).toBe(90);
    expect(placed.finalRotationDeg).toBe(90);
  });

  it('computes a freeform canvas element placement, using the element rotation and no discrete rotation', () => {
    const canvas: LayoutNode = {
      id: 'canvas',
      type: 'freeformCanvas',
      children: [{ id: 'shadow-1', type: 'imageSlot', imageSlotConfig: { scalingRule: 'fitInParent' } }],
      freeformElements: [
        {
          id: 'el-1',
          imageNodeId: 'shadow-1',
          transform: { xMm: 10, yMm: 20, widthMm: 40, heightMm: 30, rotationDeg: 15 },
        },
      ],
    };
    const assetMap = new Map([['asset-1', asset()]]);
    const result = computePagePlacements(A4, page(canvas, { 'shadow-1': 'asset-1' }), assetMap);

    expect(result.imageSlots).toHaveLength(0); // the shadow node has no layout box of its own
    expect(result.freeformCanvases).toHaveLength(1);
    const [canvasPlacement] = result.freeformCanvases;
    expect(canvasPlacement.clipBoxMm).toEqual({ x: 0, y: 0, w: 210, h: 297 });
    expect(canvasPlacement.elements).toHaveLength(1);
    const element = canvasPlacement.elements[0];
    expect(element.boxMm).toEqual({ x: 10, y: 20, w: 40, h: 30 });
    expect(element.scalingRule).toBe('fitInParent');
    expect(element.discreteRotationDeg).toBeUndefined();
    expect(element.finalRotationDeg).toBe(15);
  });

  it('insets the freeform canvas clip box by its own padding', () => {
    const canvas: LayoutNode = {
      id: 'canvas',
      type: 'freeformCanvas',
      paddingMm: { top: 5, right: 10, bottom: 15, left: 20 },
      freeformElements: [],
    };
    const result = computePagePlacements(A4, page(canvas), new Map());

    expect(result.freeformCanvases[0].clipBoxMm).toEqual({ x: 20, y: 5, w: 210 - 20 - 10, h: 297 - 5 - 15 });
  });

  it('skips a freeform element whose asset is missing', () => {
    const canvas: LayoutNode = {
      id: 'canvas',
      type: 'freeformCanvas',
      freeformElements: [
        { id: 'el-1', imageNodeId: 'shadow-1', transform: { xMm: 0, yMm: 0, widthMm: 10, heightMm: 10, rotationDeg: 0 } },
      ],
    };
    const assetMap = new Map([['asset-1', asset({ missing: true })]]);
    const result = computePagePlacements(A4, page(canvas, { 'shadow-1': 'asset-1' }), assetMap);

    expect(result.freeformCanvases[0].elements).toHaveLength(0);
  });
});
