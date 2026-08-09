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
      viewMode: 'editor',
    });
    expect(useEPPStore.temporal.getState().pastStates).toHaveLength(0);
    expect(useEPPStore.temporal.getState().futureStates).toHaveLength(0);
  });
});

describe('UI-only actions do not pollute undo/redo history', () => {
  afterEach(() => {
    useEPPStore.getState().startNewProject();
  });

  it('setViewMode toggles ui.viewMode without pushing an undo/redo history entry', () => {
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().setViewMode('preview');
    expect(useEPPStore.getState().ui.viewMode).toBe('preview');
    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);

    useEPPStore.getState().setViewMode('editor');
    expect(useEPPStore.getState().ui.viewMode).toBe('editor');
    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it('setSelectedElementIds does not push a history entry', () => {
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().setSelectedElementIds(['some-node']);

    expect(useEPPStore.getState().ui.selectedElementIds).toEqual(['some-node']);
    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it('setActiveTool does not push a history entry', () => {
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().setActiveTool('pan');

    expect(useEPPStore.getState().ui.activeTool).toBe('pan');
    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it('clearSelection does not push a history entry', () => {
    useEPPStore.getState().setSelectedElementIds(['some-node']);
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().clearSelection();

    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it('setActivePageId switching to an existing page does not push a history entry', () => {
    useEPPStore.getState().addPage();
    const secondPageId = useEPPStore.getState().document.pages[1].id;
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().setActivePageId('page-1');
    expect(useEPPStore.getState().ui.activePageId).toBe('page-1');
    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);

    useEPPStore.getState().setActivePageId(secondPageId);
    expect(useEPPStore.getState().ui.activePageId).toBe(secondPageId);
    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it('a sequence of UI-only actions after an undo does not clear the redo stack', () => {
    useEPPStore.getState().updatePageConfig('page-1', { orientation: 'landscape' });
    expect(useEPPStore.getState().document.pages[0].pageConfig.orientation).toBe('landscape');

    useEPPStore.getState().undo();
    expect(useEPPStore.getState().document.pages[0].pageConfig.orientation).toBe('portrait');
    expect(useEPPStore.temporal.getState().futureStates.length).toBeGreaterThan(0);
    const futureBefore = useEPPStore.temporal.getState().futureStates.length;

    useEPPStore.getState().setSelectedElementIds(['some-node']);
    useEPPStore.getState().setActiveTool('pan');
    useEPPStore.getState().clearSelection();
    expect(useEPPStore.temporal.getState().futureStates.length).toBe(futureBefore);

    useEPPStore.getState().redo();
    expect(useEPPStore.getState().document.pages[0].pageConfig.orientation).toBe('landscape');
  });

  it('a real document-mutating action still produces exactly one history entry', () => {
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().addPage();

    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore + 1);
  });
});

describe('addPage', () => {
  afterEach(() => {
    useEPPStore.getState().startNewProject();
  });

  it('appends a page using the app default config and a blank rootNode, and activates it', () => {
    const before = useEPPStore.getState().document.pages;

    useEPPStore.getState().addPage();

    const state = useEPPStore.getState();
    expect(state.document.pages).toHaveLength(before.length + 1);
    expect(state.document.pages[0]).toEqual(before[0]);

    const newPage = state.document.pages[1];
    expect(newPage.pageConfig).toEqual({ sizePreset: 'A4', orientation: 'portrait', dpi: 300 });
    expect(newPage.rootNode.type).toBe('imageSlot');
    expect(newPage.assignments).toEqual({});
    expect(state.ui.activePageId).toBe(newPage.id);
  });

  it('produces exactly one undo step, reverting the whole add in a single Undo', () => {
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;
    const pageCountBefore = useEPPStore.getState().document.pages.length;

    useEPPStore.getState().addPage();

    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore + 1);

    useEPPStore.temporal.getState().undo();

    expect(useEPPStore.getState().document.pages).toHaveLength(pageCountBefore);
  });

  it('undoing through the store action re-anchors activePageId instead of leaving it dangling', () => {
    const originalActiveId = useEPPStore.getState().ui.activePageId;

    useEPPStore.getState().addPage();
    expect(useEPPStore.getState().ui.activePageId).not.toBe(originalActiveId);

    useEPPStore.getState().undo();

    const state = useEPPStore.getState();
    expect(state.document.pages.map((page) => page.id)).toContain(state.ui.activePageId);
    expect(state.ui.activePageId).toBe(originalActiveId);
  });
});

describe('removePage', () => {
  afterEach(() => {
    useEPPStore.getState().startNewProject();
  });

  it('is a no-op when only one page remains', () => {
    const onlyPageId = useEPPStore.getState().document.pages[0].id;

    useEPPStore.getState().removePage(onlyPageId);

    expect(useEPPStore.getState().document.pages).toHaveLength(1);
    expect(useEPPStore.getState().document.pages[0].id).toBe(onlyPageId);
  });

  it('removes a non-active page without touching the active page or others', () => {
    useEPPStore.getState().addPage();
    useEPPStore.getState().addPage();
    const [page1, page2, page3] = useEPPStore.getState().document.pages;
    useEPPStore.getState().setActivePageId(page3.id);

    useEPPStore.getState().removePage(page2.id);

    const state = useEPPStore.getState();
    expect(state.document.pages.map((page) => page.id)).toEqual([page1.id, page3.id]);
    expect(state.ui.activePageId).toBe(page3.id);
  });

  it('removing the active (non-last) page activates the page that shifts into its old index', () => {
    useEPPStore.getState().addPage();
    useEPPStore.getState().addPage();
    const [page1, page2, page3] = useEPPStore.getState().document.pages;
    useEPPStore.getState().setActivePageId(page2.id);

    useEPPStore.getState().removePage(page2.id);

    const state = useEPPStore.getState();
    expect(state.document.pages.map((page) => page.id)).toEqual([page1.id, page3.id]);
    expect(state.ui.activePageId).toBe(page3.id);
  });

  it('removing the active page produces exactly one undo step, reverting the whole removal in a single Undo', () => {
    useEPPStore.getState().addPage();
    useEPPStore.getState().addPage();
    const pageIdsBefore = useEPPStore.getState().document.pages.map((page) => page.id);
    const activeId = useEPPStore.getState().ui.activePageId;
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().removePage(activeId);

    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore + 1);

    useEPPStore.temporal.getState().undo();

    expect(useEPPStore.getState().document.pages.map((page) => page.id)).toEqual(pageIdsBefore);
  });

  it('undoing a removal through the store action leaves activePageId on a page that still exists', () => {
    useEPPStore.getState().addPage();
    useEPPStore.getState().addPage();
    const activeId = useEPPStore.getState().ui.activePageId;

    useEPPStore.getState().removePage(activeId);
    expect(useEPPStore.getState().ui.activePageId).not.toBe(activeId);

    useEPPStore.getState().undo();

    const state = useEPPStore.getState();
    expect(state.document.pages.map((page) => page.id)).toContain(state.ui.activePageId);
  });

  it('removing the active page when it is last activates the new last page', () => {
    useEPPStore.getState().addPage();
    useEPPStore.getState().addPage();
    const [page1, page2, page3] = useEPPStore.getState().document.pages;
    expect(useEPPStore.getState().ui.activePageId).toBe(page3.id);

    useEPPStore.getState().removePage(page3.id);

    const state = useEPPStore.getState();
    expect(state.document.pages.map((page) => page.id)).toEqual([page1.id, page2.id]);
    expect(state.ui.activePageId).toBe(page2.id);
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
    // A real document change, not a ui-only one -- ui-only actions correctly no longer push
    // history (that's the very bug this store's `equality` config fixes), so this needs an
    // actual document mutation to populate pastStates before asserting openProject clears it.
    useEPPStore.getState().addPage();
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
