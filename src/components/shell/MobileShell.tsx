import { useState } from 'react';

import { PageStage } from '../canvas/PageStage.js';
import { ImageLibraryPanel } from '../panels/ImageLibraryPanel.js';
import { LayoutTreePanel } from '../panels/LayoutTreePanel.js';
import { PageSetupPanel } from '../panels/PageSetupPanel.js';
import { PropertiesPanel } from '../panels/PropertiesPanel.js';
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
 * rises as its own sheet automatically whenever something is selected -- driven by `ui.selection`,
 * the same field `PageStage` reads, per design.md Decision 5 -- rather than being a fifth tab. */
export function MobileShell({ onRequestNew, onRequestOpen, onSaveTemplate, onSaveTemplateAs, templateLibrary }: ShellProps) {
  const saveProject = useEPPStore((state) => state.saveProject);
  const setViewMode = useEPPStore((state) => state.setViewMode);
  const layoutMode = useEPPStore((state) => state.ui.layoutMode);
  const selection = useEPPStore((state) => state.ui.selection);
  const clearSelection = useEPPStore((state) => state.clearSelection);
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const { undo, redo } = useUndoRedo();
  const [openTab, setOpenTab] = useState<MobileTabId | null>(null);

  const selectionKey = selection ? `${selection.kind}:${selection.id}` : null;

  // Switching pages (including Add Page) auto-selects the newly active page's root in Simple mode
  // -- a separate mechanism from `clearSelection` (see `computeActivePageUi` in uiSlice.ts) that's
  // navigation, not a deliberate selection, so it shouldn't surface a sheet. Detecting the
  // `activePageId` change during render (not an effect) and suppressing that one accompanying
  // selectionKey immediately avoids a visible open-then-close flash. The suppression itself resets
  // the moment the selection is genuinely cleared (a real deselect happened, however it happened),
  // so a later explicit tap on that same slot -- even the one just suppressed -- opens normally:
  // without this reset, re-selecting the exact page whose auto-selection was suppressed would stay
  // suppressed forever, since nothing else would ever change the key back.
  const [lastSeenActivePageId, setLastSeenActivePageId] = useState(activePageId);
  const [suppressedPageSwitchKey, setSuppressedPageSwitchKey] = useState<string | null>(null);
  if (activePageId !== lastSeenActivePageId) {
    setLastSeenActivePageId(activePageId);
    setSuppressedPageSwitchKey(selectionKey);
  } else if (selectionKey === null && suppressedPageSwitchKey !== null) {
    setSuppressedPageSwitchKey(null);
  }

  const isPropertiesOpen = selectionKey !== null && selectionKey !== suppressedPageSwitchKey;

  // A selection takes over the sheet slot from whichever tab was open, rather than stacking on top
  // of it -- tapping a tab bar destination while Properties is showing dismisses the selection and
  // opens that tab directly (not a toggle-close, since the tab wasn't the visible sheet).
  const handleSelectTab = (tab: MobileTabId) => {
    if (isPropertiesOpen) {
      clearSelection();
      setOpenTab(tab);
      return;
    }
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

      <BottomTabBar activeTab={isPropertiesOpen ? null : openTab} onSelect={handleSelectTab} />

      <BottomSheet open={!isPropertiesOpen && openTab === 'page'} title={TAB_LABELS.page} onClose={() => setOpenTab(null)}>
        <PageSetupPanel bare />
      </BottomSheet>

      <BottomSheet open={!isPropertiesOpen && openTab === 'layout'} title={TAB_LABELS.layout} onClose={() => setOpenTab(null)}>
        <DocumentSummary />
        {layoutMode === 'nested' ? (
          <div className="mt-4">
            <LayoutTreePanel bare />
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet open={!isPropertiesOpen && openTab === 'photos'} title={TAB_LABELS.photos} onClose={() => setOpenTab(null)}>
        <ImageLibraryPanel bare />
      </BottomSheet>

      <BottomSheet open={!isPropertiesOpen && openTab === 'templates'} title={TAB_LABELS.templates} onClose={() => setOpenTab(null)}>
        <TemplateGallery
          bare
          templates={templateLibrary.templates}
          isLoading={templateLibrary.isLoading}
          errorMessage={templateLibrary.errorMessage}
          onReload={templateLibrary.reload}
        />
      </BottomSheet>

      <BottomSheet open={isPropertiesOpen} title="Properties" onClose={clearSelection}>
        <PropertiesPanel bare />
      </BottomSheet>
    </main>
  );
}
