import { isSimpleModeCompatible } from '@epp/layout-engine';

import { PageStage } from '../canvas/PageStage.js';
import { ImageLibraryPanel } from '../panels/ImageLibraryPanel.js';
import { LayoutTreePanel } from '../panels/LayoutTreePanel.js';
import { PageSetupPanel } from '../panels/PageSetupPanel.js';
import { PropertiesPanel } from '../panels/PropertiesPanel.js';
import { UnitToggle } from '../settings/UnitToggle.js';
import { TemplateGallery } from '../templates/TemplateGallery.js';
import { CollapsiblePanel } from '../ui/CollapsiblePanel.js';
import { MenuBar } from '../ui/MenuBar.js';
import { useLayoutResolution } from '../../hooks/useLayoutResolution.js';
import { useTemplateLibrary } from '../../hooks/useTemplateLibrary.js';
import { useUndoRedo } from '../../hooks/useUndoRedo.js';
import { formatLength } from '../../lib/units.js';
import { useEPPStore } from '../../store/index.js';

export interface ShellProps {
  onRequestNew: () => void;
  onRequestOpen: () => void;
  onSaveTemplate: () => void;
  onSaveTemplateAs: () => void;
  /** Lifted to `App.tsx` (not read independently here) because `useTemplateLibrary` is local
   * React state, not global store state -- a second independent instance would drift out of sync
   * with the one `SaveTemplateDialog` reloads after a save. See design.md's addendum. */
  templateLibrary: ReturnType<typeof useTemplateLibrary>;
}

/** The desktop/wide-viewport shell -- shown at or above the `lg` breakpoint (see
 * `useIsMobileViewport`). This is a mechanical extraction of what used to be `App.tsx`'s only
 * layout; behavior is unchanged. See the `mobile-shell` capability for the narrow-viewport
 * counterpart. */
export function DesktopShell({ onRequestNew, onRequestOpen, onSaveTemplate, onSaveTemplateAs, templateLibrary }: ShellProps) {
  const unitSystem = useEPPStore((state) => state.settings.unitSystem);
  const layoutMode = useEPPStore((state) => state.ui.layoutMode);
  const setLayoutMode = useEPPStore((state) => state.setLayoutMode);
  const setViewMode = useEPPStore((state) => state.setViewMode);
  const normalizePageForSimpleMode = useEPPStore((state) => state.normalizePageForSimpleMode);
  const saveProject = useEPPStore((state) => state.saveProject);
  const imagePool = useEPPStore((state) => state.imagePool);
  const imageCount = imagePool.length;
  const pageCount = useEPPStore((state) => state.document.pages.length);
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const { pageBox, page } = useLayoutResolution();
  const { undo, redo } = useUndoRedo();
  const isSimpleModeAvailable = isSimpleModeCompatible(page.rootNode);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="sticky top-0 z-30 flex-none border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        {/* Shared File/Edit menu bar -- the same component on every host, and the only way to
         * reach these eight actions now that there's no native application menu on any host
         * (see design.md, Decision 8/9). Styled to mimic a native floating menu (a label that
         * reveals a dropdown) instead of a row of always-visible buttons, to keep this from
         * reading as visual noise. */}
        <div className="mx-auto flex max-w-[1800px] items-center px-6 pt-2">
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
        </div>

        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-white">Easy Photo Print</h1>
            <p className="text-sm text-slate-400">Electron shell + shared layout engine + persisted unit settings.</p>
          </div>

          <div className="flex items-center gap-3">
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
            <TemplateGallery
              templates={templateLibrary.templates}
              isLoading={templateLibrary.isLoading}
              errorMessage={templateLibrary.errorMessage}
              onReload={templateLibrary.reload}
            />
          </aside>

          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="min-h-0 flex-1">
              <PageStage />
            </div>
            <ImageLibraryPanel />
          </div>

          <aside className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <PropertiesPanel />
            {layoutMode === 'nested' ? <LayoutTreePanel /> : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
