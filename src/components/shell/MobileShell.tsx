import { useState } from 'react';

import { PageStage } from '../canvas/PageStage.js';
import { ImageLibraryPanel } from '../panels/ImageLibraryPanel.js';
import { LayoutTreePanel } from '../panels/LayoutTreePanel.js';
import { PageSetupPanel } from '../panels/PageSetupPanel.js';
import { UnitToggle } from '../settings/UnitToggle.js';
import { TemplateGallery } from '../templates/TemplateGallery.js';
import { MenuBar } from '../ui/MenuBar.js';
import { useUndoRedo } from '../../hooks/useUndoRedo.js';
import { useEPPStore } from '../../store/index.js';
import { BottomSheet } from './BottomSheet.js';
import { BottomTabBar, type MobileTabId } from './BottomTabBar.js';
import { DocumentSummary } from './DocumentSummary.js';
import type { ShellProps } from './DesktopShell.js';

const TAB_LABELS: Record<MobileTabId, string> = {
  page: 'Page',
  layout: 'Layout',
  photos: 'Photos',
  templates: 'Templates',
};

/** The narrow/mobile shell -- shown below the `lg` breakpoint (see `useIsMobileViewport`). Unlike
 * `DesktopShell`'s three-column grid, this is canvas-first: the page preview always fills the
 * remaining height so it's never scrolled off-screen, and every panel (Page/Layout/Photos/
 * Templates) lives in a `BottomSheet` reached from `BottomTabBar` instead of a sidebar. Properties
 * auto-rising as its own sheet on selection lands in task group 6, not yet in this scaffold. */
export function MobileShell({ onRequestNew, onRequestOpen, onSaveTemplate, onSaveTemplateAs, templateLibrary }: ShellProps) {
  const saveProject = useEPPStore((state) => state.saveProject);
  const setViewMode = useEPPStore((state) => state.setViewMode);
  const layoutMode = useEPPStore((state) => state.ui.layoutMode);
  const { undo, redo } = useUndoRedo();
  const [openTab, setOpenTab] = useState<MobileTabId | null>(null);

  const handleSelectTab = (tab: MobileTabId) => {
    setOpenTab((current) => (current === tab ? null : tab));
  };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex-none border-b border-slate-800 bg-slate-900/80 px-3 pb-2 pt-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <MenuBar
            menus={[
              {
                label: 'File',
                items: [
                  { label: 'New', onClick: onRequestNew },
                  { label: 'Open', onClick: onRequestOpen },
                  { label: 'Save', onClick: () => void saveProject(false) },
                  { label: 'Save As', onClick: () => void saveProject(true) },
                ],
              },
              {
                label: 'Edit',
                items: [
                  { label: 'Undo', onClick: undo },
                  { label: 'Redo', onClick: redo },
                  { label: 'Save Template', onClick: onSaveTemplate },
                  { label: 'Save Template As', onClick: onSaveTemplateAs },
                ],
              },
            ]}
          />
          <div className="flex items-center gap-2">
            <UnitToggle />
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className="rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-3 py-3 pb-16">
        <PageStage />
      </div>

      <BottomTabBar activeTab={openTab} onSelect={handleSelectTab} />

      <BottomSheet open={openTab === 'page'} title={TAB_LABELS.page} onClose={() => setOpenTab(null)}>
        <PageSetupPanel bare />
      </BottomSheet>

      <BottomSheet open={openTab === 'layout'} title={TAB_LABELS.layout} onClose={() => setOpenTab(null)}>
        <DocumentSummary />
        {layoutMode === 'nested' ? (
          <div className="mt-4">
            <LayoutTreePanel bare />
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet open={openTab === 'photos'} title={TAB_LABELS.photos} onClose={() => setOpenTab(null)}>
        <ImageLibraryPanel bare />
      </BottomSheet>

      <BottomSheet open={openTab === 'templates'} title={TAB_LABELS.templates} onClose={() => setOpenTab(null)}>
        <TemplateGallery
          bare
          templates={templateLibrary.templates}
          isLoading={templateLibrary.isLoading}
          errorMessage={templateLibrary.errorMessage}
          onReload={templateLibrary.reload}
        />
      </BottomSheet>
    </main>
  );
}
