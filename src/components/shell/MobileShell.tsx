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

  // `ui.selection` can't be trusted as a plain open/closed signal: in Simple mode, `clearSelection`
  // falls back to selecting the page's root node instead of nulling it (desktop's always-visible
  // Properties sidebar needs something to show -- see `computeDefaultSelection` in uiSlice.ts), so
  // the store's selection never actually becomes null once anything's been selected. Tracking which
  // exact selection was last dismissed here (rather than changing the shared store) keeps desktop's
  // behavior untouched: the sheet closes on a user dismissal and reopens only when the selection
  // becomes something new, matching the mobile-shell capability's requirement without relying on a
  // signal the store doesn't reliably provide.
  const selectionKey = selection ? `${selection.kind}:${selection.id}` : null;
  const [dismissedSelectionKey, setDismissedSelectionKey] = useState<string | null>(null);

  // Switching pages (including Add Page) re-runs the same Simple-mode default-selection fallback,
  // auto-selecting the newly active page's root -- confirmed this pops Properties open on every
  // page switch, including a brand new session's very first "Add Page" tap, since it's a genuinely
  // new selectionKey. That's navigation, not a deliberate selection, so it shouldn't surface a sheet;
  // detecting the activePageId change during render (not an effect) and dismissing it immediately
  // avoids a visible open-then-close flash. An explicit tap on a slot afterward still opens normally.
  const [lastSeenActivePageId, setLastSeenActivePageId] = useState(activePageId);
  if (activePageId !== lastSeenActivePageId) {
    setLastSeenActivePageId(activePageId);
    setDismissedSelectionKey(selectionKey);
  }

  const isPropertiesOpen = selectionKey !== null && selectionKey !== dismissedSelectionKey;

  const dismissProperties = () => {
    setDismissedSelectionKey(selectionKey);
    clearSelection();
  };

  // A selection takes over the sheet slot from whichever tab was open, rather than stacking on top
  // of it -- tapping a tab bar destination while Properties is showing dismisses the selection and
  // opens that tab directly (not a toggle-close, since the tab wasn't the visible sheet).
  const handleSelectTab = (tab: MobileTabId) => {
    if (isPropertiesOpen) {
      dismissProperties();
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

      <BottomSheet open={isPropertiesOpen} title="Properties" onClose={dismissProperties}>
        <PropertiesPanel bare />
      </BottomSheet>
    </main>
  );
}
