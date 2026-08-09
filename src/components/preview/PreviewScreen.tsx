import { useEPPStore } from '../../store/index.js';
import { PreviewPageSwitcher } from './PreviewPageSwitcher.js';
import { PreviewStage } from './PreviewStage.js';

/** Full-screen, gizmo-free print preview -- replaces the entire editor layout while
 * `ui.viewMode === 'preview'`. "Export PDF" and "Print" are visually present but intentionally
 * inert in this iteration; see print-preview spec, "Export and Print Controls Are Present
 * Without Behavior". */
export function PreviewScreen() {
  const setViewMode = useEPPStore((state) => state.setViewMode);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex flex-none items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <button
          type="button"
          onClick={() => setViewMode('editor')}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-600"
        >
          Back to editor
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-600"
          >
            Export PDF
          </button>
          <button
            type="button"
            className="rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
          >
            Print
          </button>
        </div>
      </div>

      <PreviewStage />

      <div className="flex flex-none justify-center border-t border-slate-800 bg-slate-900/80 px-6 py-4">
        <PreviewPageSwitcher />
      </div>
    </main>
  );
}
