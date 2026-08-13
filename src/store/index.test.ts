import { afterEach, describe, expect, it } from 'vitest';

import type { EPPProject, ImageAsset } from '@epp/layout-engine';

import { registerPlatformAdapter, type EppAPI } from '../lib/platform/contract.js';
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
  registerPlatformAdapter({
    fs: {
      saveProject: overrides.saveProject ?? (async () => null),
      openProject: overrides.openProject ?? (async () => null),
      resetWorkingStorage: async () => {},
    },
    dialog: {
      relinkImage: overrides.relinkImage ?? (async () => null),
    },
  } as unknown as EppAPI);
}

// startNewProject() (exercised via afterEach in most describe blocks below, not always preceded
// by an explicit installMockEppApi() call) fire-and-forgets fs.resetWorkingStorage() -- register a
// safe default up front so every test in this file has a working adapter from the start.
installMockEppApi({});

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
      selection: null,
      activeTool: 'select',
      layoutMode: 'simple',
      viewMode: 'editor',
      processingOverlay: { visible: false },
      slotClipboard: null,
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

  it('setSelection does not push a history entry', () => {
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().setSelection({ kind: 'node', id: 'some-node' });

    expect(useEPPStore.getState().ui.selection).toEqual({ kind: 'node', id: 'some-node' });
    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it('setActiveTool does not push a history entry', () => {
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().setActiveTool('pan');

    expect(useEPPStore.getState().ui.activeTool).toBe('pan');
    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it('clearSelection does not push a history entry', () => {
    useEPPStore.getState().setSelection({ kind: 'node', id: 'some-node' });
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

    useEPPStore.getState().setSelection({ kind: 'node', id: 'some-node' });
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
    const sheetSizeBefore = useEPPStore.getState().document.sheetSize;

    useEPPStore.getState().addPage();

    const state = useEPPStore.getState();
    expect(state.document.pages).toHaveLength(before.length + 1);
    expect(state.document.pages[0]).toEqual(before[0]);
    expect(state.document.sheetSize).toEqual(sheetSizeBefore);

    const newPage = state.document.pages[1];
    expect(newPage.pageConfig).toEqual({ orientation: 'portrait', dpi: 300 });
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
      sheetSize: { sizePreset: 'Letter' },
      pages: [
        {
          id: 'opened-page',
          pageConfig: { orientation: 'portrait', dpi: 300 },
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
    expect(next.document.sheetSize).toEqual(openedProject.sheetSize);
    expect(next.imagePool).toEqual(openedProject.imagePool);
    expect(next.project).toEqual({ id: 'opened-project', name: 'Opened Album', filePath: '/home/user/Opened.eppproj' });
    expect(useEPPStore.temporal.getState().pastStates).toHaveLength(0);
  });
});

describe('copySlotProperties / pasteSlotProperties', () => {
  afterEach(() => {
    useEPPStore.getState().startNewProject();
  });

  it('copySlotProperties captures the slot\'s properties into ui.slotClipboard without pushing a history entry', () => {
    useEPPStore.getState().assignImageToSlot('page-1', 'root-grid', 'image-a');
    useEPPStore.getState().rotateSlotImage('page-1', 'root-grid');
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().copySlotProperties('page-1', 'root-grid');

    expect(useEPPStore.getState().ui.slotClipboard).toEqual({
      imageAssetId: 'image-a',
      scalingRule: 'fitInParent',
      imageRotationDeg: 90,
      paddingMm: { top: 5, right: 5, bottom: 5, left: 5 },
    });
    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it('pasteSlotProperties is a no-op when nothing has been copied yet', () => {
    const before = useEPPStore.getState().document.pages[0].rootNode;

    useEPPStore.getState().pasteSlotProperties('page-1', 'root-grid');

    expect(useEPPStore.getState().document.pages[0].rootNode).toBe(before);
  });

  it('pasteSlotProperties overwrites a different target slot in exactly one undo step', () => {
    useEPPStore.getState().retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    const [slot1, slot2] = useEPPStore.getState().document.pages[0].rootNode.children!.map((child) => child.id);
    useEPPStore.getState().assignImageToSlot('page-1', slot1, 'image-a');
    useEPPStore.getState().rotateSlotImage('page-1', slot1);
    useEPPStore.getState().copySlotProperties('page-1', slot1);
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().pasteSlotProperties('page-1', slot2);

    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore + 1);
    const slot2Node = useEPPStore.getState().document.pages[0].rootNode.children!.find((child) => child.id === slot2)!;
    expect(useEPPStore.getState().document.pages[0].assignments[slot2]).toBe('image-a');
    expect(slot2Node.imageSlotConfig?.imageRotationDeg).toBe(90);

    useEPPStore.temporal.getState().undo();
    expect(useEPPStore.getState().document.pages[0].assignments[slot2]).toBeUndefined();
  });

  it('pasting onto the same slot that was copied reapplies its properties unchanged, without error', () => {
    useEPPStore.getState().assignImageToSlot('page-1', 'root-grid', 'image-a');
    useEPPStore.getState().copySlotProperties('page-1', 'root-grid');

    expect(() => useEPPStore.getState().pasteSlotProperties('page-1', 'root-grid')).not.toThrow();

    expect(useEPPStore.getState().document.pages[0].assignments['root-grid']).toBe('image-a');
  });

  it('the clipboard is a value snapshot: editing or removing the source slot afterward does not change what Paste applies', () => {
    useEPPStore.getState().assignImageToSlot('page-1', 'root-grid', 'image-a');
    useEPPStore.getState().copySlotProperties('page-1', 'root-grid');

    // Mutate the source after copying.
    useEPPStore.getState().rotateSlotImage('page-1', 'root-grid');
    useEPPStore.getState().retypeLayoutNode('page-1', 'root-grid', 'grid'); // no longer even an imageSlot

    useEPPStore.getState().addPage();
    const newPageId = useEPPStore.getState().ui.activePageId;
    const newSlotId = useEPPStore.getState().document.pages[1].rootNode.id;

    useEPPStore.getState().pasteSlotProperties(newPageId, newSlotId);

    const pastedNode = useEPPStore.getState().document.pages[1].rootNode;
    expect(pastedNode.imageSlotConfig?.imageRotationDeg).toBe(0);
    expect(useEPPStore.getState().document.pages[1].assignments[newSlotId]).toBe('image-a');
  });

  it('copySlotPropertiesToPage does not affect imageSlot nodes on other pages', () => {
    useEPPStore.getState().retypeLayoutNode('page-1', 'root-grid', 'horizontal');
    const [slot1] = useEPPStore.getState().document.pages[0].rootNode.children!.map((child) => child.id);
    useEPPStore.getState().addPage();
    const [firstPageId] = useEPPStore.getState().document.pages.map((page) => page.id);
    const secondPageRootId = useEPPStore.getState().document.pages[1].rootNode.id;

    useEPPStore.getState().assignImageToSlot(firstPageId, slot1, 'image-a');

    useEPPStore.getState().copySlotPropertiesToPage(firstPageId, slot1);

    expect(useEPPStore.getState().document.pages[1].assignments[secondPageRootId]).toBeUndefined();
  });
});

describe('relinkImage', () => {
  afterEach(() => {
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

describe('envelopeParent focalPoint pan gesture batches into a single undo step', () => {
  afterEach(() => {
    useEPPStore.getState().startNewProject();
  });

  it('multiple live focalPoint updates collapse into one undo entry, when only the first is tracked before pausing', () => {
    // Mirrors useEnvelopeParentPanGesture's actual sequencing: the first update must land while
    // history is still tracking (so its pre-drag snapshot is captured), and pauseHistory only
    // takes effect starting with the *second* update -- pausing before the first update would
    // mean that update's own "before" state is never recorded, leaving zero undo entries for the
    // whole gesture instead of one (confirmed against zundo's actual pause/resume semantics,
    // which do not retroactively record what changed during a paused span).
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().updateLayoutNode('page-1', 'root-grid', { imageSlotConfig: { focalPoint: { x: 0.3, y: 0.4 } } });
    useEPPStore.getState().pauseHistory();
    useEPPStore.getState().updateLayoutNode('page-1', 'root-grid', { imageSlotConfig: { focalPoint: { x: 0.6, y: 0.7 } } });
    useEPPStore.getState().updateLayoutNode('page-1', 'root-grid', { imageSlotConfig: { focalPoint: { x: 0.9, y: 1 } } });
    useEPPStore.getState().resumeHistory();

    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore + 1);
    expect(useEPPStore.getState().document.pages[0].rootNode.imageSlotConfig?.focalPoint).toEqual({ x: 0.9, y: 1 });

    useEPPStore.getState().undo();
    expect(useEPPStore.getState().document.pages[0].rootNode.imageSlotConfig?.focalPoint).toBeUndefined();
  });

  it('pausing before the very first update loses that update from history entirely (documents the underlying zundo behavior this hook works around)', () => {
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().pauseHistory();
    useEPPStore.getState().updateLayoutNode('page-1', 'root-grid', { imageSlotConfig: { focalPoint: { x: 0.3, y: 0.4 } } });
    useEPPStore.getState().resumeHistory();

    expect(useEPPStore.getState().document.pages[0].rootNode.imageSlotConfig?.focalPoint).toEqual({ x: 0.3, y: 0.4 });
    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it('a pause/resume cycle with no focalPoint change in between creates no undo entry', () => {
    const pastBefore = useEPPStore.temporal.getState().pastStates.length;

    useEPPStore.getState().pauseHistory();
    useEPPStore.getState().resumeHistory();

    expect(useEPPStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });
});
