import { useEffect, useRef, useState } from 'react';

import { PreviewScreen } from './components/preview/PreviewScreen.js';
import { DesktopShell } from './components/shell/DesktopShell.js';
import { MobileShell } from './components/shell/MobileShell.js';
import { SaveTemplateDialog, type SaveTemplateDialogHandle } from './components/templates/SaveTemplateDialog.js';
import { ConfirmDialog } from './components/ui/ConfirmDialog.js';
import { ProcessingOverlay } from './components/ui/ProcessingOverlay.js';
import { useIsMobileViewport } from './hooks/useIsMobileViewport.js';
import { useTemplateLibrary } from './hooks/useTemplateLibrary.js';
import { useUndoRedo } from './hooks/useUndoRedo.js';
import { useEPPStore } from './store/index.js';

export function App() {
  const saveTemplateDialogRef = useRef<SaveTemplateDialogHandle>(null);
  const [isNewProjectConfirmOpen, setIsNewProjectConfirmOpen] = useState(false);
  const [isOpenProjectConfirmOpen, setIsOpenProjectConfirmOpen] = useState(false);
  const [isMissingImagesDialogOpen, setIsMissingImagesDialogOpen] = useState(false);
  const templateLibrary = useTemplateLibrary();
  const isMobileViewport = useIsMobileViewport();
  const hydrateSettings = useEPPStore((state) => state.hydrateSettings);
  const viewMode = useEPPStore((state) => state.ui.viewMode);
  const setViewMode = useEPPStore((state) => state.setViewMode);
  const startNewProject = useEPPStore((state) => state.startNewProject);
  const openProject = useEPPStore((state) => state.openProject);
  const saveProject = useEPPStore((state) => state.saveProject);
  const relinkImage = useEPPStore((state) => state.relinkImage);
  const imagePool = useEPPStore((state) => state.imagePool);
  const missingImages = imagePool.filter((asset) => asset.missing);
  const clearSelection = useEPPStore((state) => state.clearSelection);
  const isProcessingOverlayVisible = useEPPStore((state) => state.ui.processingOverlay.visible);
  const { undo, redo } = useUndoRedo();
  const inertContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `inert` isn't in this React version's JSX attribute types yet (@types/react 18), so it's set
    // as a plain DOM property here instead of a JSX prop -- TypeScript's DOM lib already types
    // `HTMLElement.inert`, and Electron's bundled Chromium has supported the attribute since M102.
    if (inertContentRef.current) {
      inertContentRef.current.inert = isProcessingOverlayVisible;
    }
  }, [isProcessingOverlayVisible]);

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // The processing overlay blocks all interaction with the rest of the app, keyboard
      // shortcuts included (see the `processing-overlay` capability), while an image-library load,
      // PDF export, or print is in flight.
      if (isProcessingOverlayVisible) {
        return;
      }

      if (event.key === 'Escape') {
        // A ConfirmDialog has its own Escape listener (dismiss the dialog) that fires
        // independently of this one -- without this guard, Escape while a dialog is open in
        // preview would both close the dialog and exit preview in the same keystroke, when the
        // user only meant to dismiss the modal on top.
        if (isNewProjectConfirmOpen || isOpenProjectConfirmOpen || isMissingImagesDialogOpen) {
          return;
        }
        if (viewMode === 'preview') {
          setViewMode('editor');
          return;
        }
        clearSelection();
        return;
      }

      // Desktop keyboard shortcuts for the same eight actions the menu bar exposes -- there is no
      // native application menu to bind accelerators to anymore (see design.md, Decision 8's
      // follow-up), so this replicates CmdOrCtrl+N/O/S/Shift+S/Z/Shift+Z directly in shared code.
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'n':
          event.preventDefault();
          setIsNewProjectConfirmOpen(true);
          break;
        case 'o':
          event.preventDefault();
          setIsOpenProjectConfirmOpen(true);
          break;
        case 's':
          event.preventDefault();
          void saveProject(event.shiftKey);
          break;
        case 'z':
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    clearSelection,
    viewMode,
    setViewMode,
    isNewProjectConfirmOpen,
    isOpenProjectConfirmOpen,
    isMissingImagesDialogOpen,
    isProcessingOverlayVisible,
    saveProject,
    undo,
    redo,
  ]);

  const shellProps = {
    onRequestNew: () => setIsNewProjectConfirmOpen(true),
    onRequestOpen: () => setIsOpenProjectConfirmOpen(true),
    onSaveTemplate: () => saveTemplateDialogRef.current?.openSave(),
    onSaveTemplateAs: () => saveTemplateDialogRef.current?.openSaveAs(),
    templateLibrary,
  };

  return (
    <>
      {/* `inert` (not just the overlay's own pointer-capturing backdrop) is what actually keeps
       * keyboard users from Tab-ing to a control behind the overlay and activating it via
       * Enter/Space -- pointer-events stacking alone has no effect on keyboard focus order. */}
      <div className="contents" ref={inertContentRef}>
        {viewMode === 'preview' ? (
          <PreviewScreen />
        ) : isMobileViewport ? (
          <MobileShell {...shellProps} />
        ) : (
          <DesktopShell {...shellProps} />
        )}

        <SaveTemplateDialog ref={saveTemplateDialogRef} templates={templateLibrary.templates} onSaved={templateLibrary.reload} />

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
      </div>

      <ProcessingOverlay />
    </>
  );
}
