import { afterEach, describe, expect, it } from 'vitest';

import type { EPPProject, ImageAsset } from '@epp/layout-engine';

import type { EppAPI } from '../lib/ipc-client.js';
import { useEPPStore } from './index.js';

function createTestAsset(id: string, overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    id,
    originalPath: `/tmp/${id}.jpg`,
    storedPath: `/tmp/${id}.jpg`,
    fileName: `${id}.jpg`,
    widthPx: 800,
    heightPx: 600,
    thumbnailDataUrl: 'data:image/png;base64,',
    ...overrides,
  };
}

function installMockEppApi(overrides: {
  saveProject?: EppAPI['fs']['saveProject'];
  openProject?: EppAPI['fs']['openProject'];
  relinkImage?: EppAPI['dialog']['relinkImage'];
}) {
  (globalThis as { window?: unknown }).window = {
    eppAPI: {
      fs: {
        saveProject: overrides.saveProject ?? (async () => null),
        openProject: overrides.openProject ?? (async () => null),
      },
      dialog: {
        relinkImage: overrides.relinkImage ?? (async () => null),
      },
    } as unknown as EppAPI,
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

describe('saveProject', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    useEPPStore.getState().startNewProject();
  });

  it('prompts for a path (existingPath: null) on the first save', async () => {
    let receivedOptions: { existingPath: string | null; forceDialog: boolean } | undefined;
    installMockEppApi({
      saveProject: async (_project, options) => {
        receivedOptions = options;
        return '/home/user/My Album.eppproj';
      },
    });

    await useEPPStore.getState().saveProject(false);

    expect(receivedOptions).toEqual({ existingPath: null, forceDialog: false });
    expect(useEPPStore.getState().project.filePath).toBe('/home/user/My Album.eppproj');
    expect(useEPPStore.getState().project.name).toBe('My Album');
  });

  it('passes the remembered path on a subsequent save without forcing the dialog', async () => {
    let receivedOptions: { existingPath: string | null; forceDialog: boolean } | undefined;
    installMockEppApi({
      saveProject: async (_project, options) => {
        receivedOptions = options;
        return options.existingPath ?? '/home/user/My Album.eppproj';
      },
    });

    await useEPPStore.getState().saveProject(false);
    await useEPPStore.getState().saveProject(false);

    expect(receivedOptions).toEqual({ existingPath: '/home/user/My Album.eppproj', forceDialog: false });
  });

  it('forces the dialog for Save As even when a path is already remembered', async () => {
    const receivedForceDialog: boolean[] = [];
    installMockEppApi({
      saveProject: async (_project, options) => {
        receivedForceDialog.push(options.forceDialog);
        return '/home/user/My Album.eppproj';
      },
    });

    await useEPPStore.getState().saveProject(false);
    await useEPPStore.getState().saveProject(true);

    expect(receivedForceDialog).toEqual([false, true]);
  });

  it('leaves the remembered path untouched when the save dialog is canceled', async () => {
    installMockEppApi({ saveProject: async () => null });

    await useEPPStore.getState().saveProject(false);

    expect(useEPPStore.getState().project.filePath).toBeNull();
  });
});

describe('openProject', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    useEPPStore.getState().startNewProject();
  });

  it('returns false and leaves state untouched when the native picker is canceled', async () => {
    useEPPStore.setState((state) => ({ imagePool: [...state.imagePool, createTestAsset('kept')] }));
    installMockEppApi({ openProject: async () => null });

    const didLoad = await useEPPStore.getState().openProject();

    expect(didLoad).toBe(false);
    expect(useEPPStore.getState().imagePool.map((asset) => asset.id)).toEqual(['kept']);
  });

  it('replaces document/imagePool, clears undo history, and remembers the opened path', async () => {
    useEPPStore.getState().setActiveTool('pan');
    expect(useEPPStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    const openedProject: EPPProject = {
      schemaVersion: '1.0.0',
      id: 'opened-project',
      name: 'Opened Album',
      pages: [
        {
          id: 'opened-page',
          pageConfig: { sizePreset: 'A4', orientation: 'portrait', dpi: 300 },
          rootNode: { id: 'opened-root', type: 'imageSlot' },
          assignments: {},
        },
      ],
      imagePool: [createTestAsset('opened-asset')],
    };
    installMockEppApi({ openProject: async () => ({ project: openedProject, filePath: '/home/user/Opened.eppproj' }) });

    const didLoad = await useEPPStore.getState().openProject();

    expect(didLoad).toBe(true);
    const next = useEPPStore.getState();
    expect(next.document.pages).toEqual(openedProject.pages);
    expect(next.imagePool).toEqual(openedProject.imagePool);
    expect(next.project).toEqual({ id: 'opened-project', name: 'Opened Album', filePath: '/home/user/Opened.eppproj' });
    expect(useEPPStore.temporal.getState().pastStates).toHaveLength(0);
  });
});

describe('relinkImage', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    useEPPStore.getState().startNewProject();
  });

  it('updates only the targeted asset, clearing its missing flag', async () => {
    useEPPStore.setState({
      imagePool: [
        createTestAsset('missing-1', { missing: true, originalPath: '/tmp/gone.jpg' }),
        createTestAsset('other', { missing: true, originalPath: '/tmp/also-gone.jpg' }),
      ],
    });
    installMockEppApi({
      relinkImage: async () => ({
        originalPath: '/tmp/found.jpg',
        storedPath: '/tmp/found.jpg',
        fileName: 'found.jpg',
        widthPx: 1024,
        heightPx: 768,
        thumbnailDataUrl: 'data:image/png;base64,BB==',
      }),
    });

    await useEPPStore.getState().relinkImage('missing-1');

    const [relinked, other] = useEPPStore.getState().imagePool;
    expect(relinked).toMatchObject({ id: 'missing-1', originalPath: '/tmp/found.jpg', widthPx: 1024 });
    expect(relinked.missing).toBeUndefined();
    expect(other).toMatchObject({ id: 'other', missing: true });
  });

  it('leaves the image pool untouched when the native picker is canceled', async () => {
    useEPPStore.setState({ imagePool: [createTestAsset('missing-1', { missing: true })] });
    installMockEppApi({ relinkImage: async () => null });

    await useEPPStore.getState().relinkImage('missing-1');

    expect(useEPPStore.getState().imagePool[0].missing).toBe(true);
  });
});
