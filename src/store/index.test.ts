import { describe, expect, it } from 'vitest';

import type { ImageAsset } from '@epp/layout-engine';

import { useEPPStore } from './index.js';

function createTestAsset(id: string): ImageAsset {
  return {
    id,
    originalPath: `/tmp/${id}.jpg`,
    storedPath: `/tmp/${id}.jpg`,
    fileName: `${id}.jpg`,
    widthPx: 800,
    heightPx: 600,
    thumbnailDataUrl: 'data:image/png;base64,',
  };
}

describe('startNewProject', () => {
  it('resets document/ui/imagePool to a fresh single-page project and clears undo/redo history', () => {
    const initialPageId = useEPPStore.getState().document.pages[0].id;

    useEPPStore.getState().updatePageConfig(initialPageId, { orientation: 'landscape' });
    useEPPStore.getState().setActiveTool('pan');
    useEPPStore.setState((state) => ({ imagePool: [...state.imagePool, createTestAsset('asset-1')] }));

    expect(useEPPStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    useEPPStore.getState().startNewProject();

    const next = useEPPStore.getState();
    expect(next.document.pages).toHaveLength(1);
    expect(next.document.pages[0].id).toBe('page-1');
    expect(next.document.pages[0].rootNode.type).toBe('imageSlot');
    expect(next.document.pages[0].pageConfig.orientation).toBe('portrait');
    expect(next.imagePool).toEqual([]);
    expect(next.ui).toEqual({
      activePageId: 'page-1',
      selectedElementIds: [],
      activeTool: 'select',
      layoutMode: 'simple',
    });
    expect(useEPPStore.temporal.getState().pastStates).toHaveLength(0);
    expect(useEPPStore.temporal.getState().futureStates).toHaveLength(0);
  });
});
