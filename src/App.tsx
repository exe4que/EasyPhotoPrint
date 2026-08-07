import { isSimpleModeCompatible } from '@epp/layout-engine';
import { useEffect, useState } from 'react';

import { PageStage } from './components/canvas/PageStage.js';
import { ImageLibraryPanel } from './components/panels/ImageLibraryPanel.js';
import { LayoutTreePanel } from './components/panels/LayoutTreePanel.js';
import { PageSetupPanel } from './components/panels/PageSetupPanel.js';
import { PropertiesPanel } from './components/panels/PropertiesPanel.js';
import { SelectionPanel } from './components/panels/SelectionPanel.js';
import { UnitToggle } from './components/settings/UnitToggle.js';
import { SaveTemplateDialog } from './components/templates/SaveTemplateDialog.js';
import { TemplateGallery } from './components/templates/TemplateGallery.js';
import { CollapsiblePanel } from './components/ui/CollapsiblePanel.js';
import { ConfirmDialog } from './components/ui/ConfirmDialog.js';
import { useLayoutResolution } from './hooks/useLayoutResolution.js';
import { useTemplateLibrary } from './hooks/useTemplateLibrary.js';
import { useUndoRedo } from './hooks/useUndoRedo.js';
import { getEppApi } from './lib/ipc-client.js';
import { formatLength } from './lib/units.js';
import { useEPPStore } from './store/index.js';

export function App() {
  const [selectedImageAssetId, setSelectedImageAssetId] = useState<string | null>(null);
  const [isNewProjectConfirmOpen, setIsNewProjectConfirmOpen] = useState(false);
  const [isOpenProjectConfirmOpen, setIsOpenProjectConfirmOpen] = useState(false);
  const [isMissingImagesDialogOpen, setIsMissingImagesDialogOpen] = useState(false);
  const templateLibrary = useTemplateLibrary();
  const hydrateSettings = useEPPStore((state) => state.hydrateSettings);
  const unitSystem = useEPPStore((state) => state.settings.unitSystem);
  const layoutMode = useEPPStore((state) => state.ui.layoutMode);
  const setLayoutMode = useEPPStore((state) => state.setLayoutMode);
  const normalizePageForSimpleMode = useEPPStore((state) => state.normalizePageForSimpleMode);
  const startNewProject = useEPPStore((state) => state.startNewProject);
  const openProject = useEPPStore((state) => state.openProject);
  const saveProject = useEPPStore((state) => state.saveProject);
  const relinkImage = useEPPStore((state) => state.relinkImage);
  const imagePool = useEPPStore((state) => state.imagePool);
  const imageCount = imagePool.length;
  const missingImages = imagePool.filter((asset) => asset.missing);
  const pageCount = useEPPStore((state) => state.document.pages.length);
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const clearSelection = useEPPStore((state) => state.clearSelection);
  const { pageBox, page } = useLayoutResolution();
  const { undo, redo } = useUndoRedo();
  const isSimpleModeAvailable = isSimpleModeCompatible(page.rootNode);

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    return getEppApi().menu.onNewProject(() => {
      setIsNewProjectConfirmOpen(true);
    });
  }, []);

  useEffect(() => {
    return getEppApi().menu.onOpenProject(() => {
      setIsOpenProjectConfirmOpen(true);
    });
  }, []);

  useEffect(() => {
    return getEppApi().menu.onSaveProject(() => {
      void saveProject(false);
    });
  }, [saveProject]);

  useEffect(() => {
    return getEppApi().menu.onSaveProjectAs(() => {
      void saveProject(true);
    });
  }, [saveProject]);

  useEffect(() => {
    return getEppApi().menu.onUndo(undo);
  }, [undo]);

  useEffect(() => {
    return getEppApi().menu.onRedo(redo);
  }, [redo]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [clearSelection]);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="sticky top-0 z-30 flex-none border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-white">Easy Photo Print</h1>
            <p className="text-sm text-slate-400">
              Electron shell + shared layout engine + persisted unit settings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <UnitToggle />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-6 py-6">
        <div className="mx-auto grid h-full max-w-[1800px] gap-6 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
          <aside className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <CollapsiblePanel title="Document" defaultCollapsed={false}>
              <dl className="grid gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Pages</dt>
                  <dd>{pageCount}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Current layout mode</dt>
                  <dd className="capitalize">{layoutMode}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Image pool</dt>
                  <dd>{imageCount}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Page size</dt>
                  <dd>{`${formatLength(pageBox.w, unitSystem)} x ${formatLength(pageBox.h, unitSystem)}`}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Orientation</dt>
                  <dd className="capitalize">{page.pageConfig.orientation}</dd>
                </div>
              </dl>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {(['simple', 'nested'] as const).map((mode) => {
                  const isDisabled = mode === 'simple' && !isSimpleModeAvailable;
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={isDisabled}
                      title={
                        isDisabled
                          ? 'Simple mode requires a layout with at most two levels, where the bottom level is only image slots.'
                          : undefined
                      }
                      onClick={() => {
                        if (mode === 'simple') {
                          normalizePageForSimpleMode(activePageId);
                        }
                        setLayoutMode(mode);
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium uppercase tracking-wide ${
                        layoutMode === mode
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                          : isDisabled
                            ? 'cursor-not-allowed border-slate-800 bg-slate-950 text-slate-600'
                            : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </CollapsiblePanel>

            <PageSetupPanel />
            <SaveTemplateDialog templates={templateLibrary.templates} onSaved={templateLibrary.reload} />
            <TemplateGallery
              templates={templateLibrary.templates}
              isLoading={templateLibrary.isLoading}
              errorMessage={templateLibrary.errorMessage}
              onReload={templateLibrary.reload}
            />
            {layoutMode === 'nested' ? <LayoutTreePanel /> : null}
          </aside>

          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="min-h-0 flex-1">
              <PageStage />
            </div>
            <ImageLibraryPanel
              selectedImageAssetId={selectedImageAssetId}
              onSelectImageAssetId={setSelectedImageAssetId}
            />
          </div>

          <aside className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <SelectionPanel
              selectedImageAssetId={selectedImageAssetId}
              onClearSelectedImage={() => setSelectedImageAssetId(null)}
            />
            <PropertiesPanel />
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={isNewProjectConfirmOpen}
        title="Start a new project?"
        description="This discards every page, image, and undo/redo history in the current document and starts over with a single blank page, as if the app had just been opened. This can't be undone."
        confirmLabel="Start new project"
        destructive
        onConfirm={() => {
          startNewProject();
          setIsNewProjectConfirmOpen(false);
        }}
        onCancel={() => setIsNewProjectConfirmOpen(false)}
      />

      <ConfirmDialog
        open={isOpenProjectConfirmOpen}
        title="Open a project?"
        description="This discards every page, image, and undo/redo history in the current document. Choose a .eppproj file in the next dialog to replace it. This can't be undone."
        confirmLabel="Choose file..."
        destructive
        onConfirm={() => {
          setIsOpenProjectConfirmOpen(false);
          void openProject().then((didLoad) => {
            if (didLoad && useEPPStore.getState().imagePool.some((asset) => asset.missing)) {
              setIsMissingImagesDialogOpen(true);
            }
          });
        }}
        onCancel={() => setIsOpenProjectConfirmOpen(false)}
      />

      <ConfirmDialog
        open={isMissingImagesDialogOpen}
        title={missingImages.length === 0 ? 'All reference problems resolved' : 'Some images could not be found'}
        description={
          missingImages.length === 0
            ? 'Every missing image in this project has been relinked.'
            : "These images' files have moved, been renamed, or been deleted since this project was last saved. The project loaded anyway — locate a replacement for each one now, or later from its card in the Image Library."
        }
        confirmLabel="Done"
        onConfirm={() => setIsMissingImagesDialogOpen(false)}
        onCancel={() => setIsMissingImagesDialogOpen(false)}
      >
        <ul className="space-y-2">
          {missingImages.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
            >
              <span className="truncate text-slate-200">{asset.fileName}</span>
              <button
                type="button"
                onClick={() => void relinkImage(asset.id)}
                className="whitespace-nowrap rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
              >
                Locate...
              </button>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </main>
  );
}
