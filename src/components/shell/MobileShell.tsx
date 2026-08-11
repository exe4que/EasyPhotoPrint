import { PageStage } from '../canvas/PageStage.js';
import { UnitToggle } from '../settings/UnitToggle.js';
import { MenuBar } from '../ui/MenuBar.js';
import { useUndoRedo } from '../../hooks/useUndoRedo.js';
import { useEPPStore } from '../../store/index.js';
import type { ShellProps } from './DesktopShell.js';

/** The narrow/mobile shell -- shown below the `lg` breakpoint (see `useIsMobileViewport`). Unlike
 * `DesktopShell`'s three-column grid, this is canvas-first: the page preview always fills the
 * remaining height so it's never scrolled off-screen, and every panel (Page/Layout/Photos/
 * Templates, plus Properties on selection) lives in a bottom sheet instead of a sidebar -- added in
 * task group 5/6, not yet in this scaffold. */
export function MobileShell({ onRequestNew, onRequestOpen, onSaveTemplate, onSaveTemplateAs }: ShellProps) {
  const saveProject = useEPPStore((state) => state.saveProject);
  const setViewMode = useEPPStore((state) => state.setViewMode);
  const { undo, redo } = useUndoRedo();

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

      <div className="min-h-0 flex-1 px-3 py-3">
        <PageStage />
      </div>
    </main>
  );
}
