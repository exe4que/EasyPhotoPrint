import { useState } from 'react';

import { useEPPStore } from '../../store/index.js';
import { PreviewPageSwitcher } from './PreviewPageSwitcher.js';
import { PreviewStage } from './PreviewStage.js';

type ActionState = { status: 'idle' | 'busy' | 'error'; message?: string };

const IDLE_ACTION_STATE: ActionState = { status: 'idle' };

function describeActionError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** Full-screen, gizmo-free print preview -- replaces the entire editor layout while
 * `ui.viewMode === 'preview'`. "Export PDF" and "Print" each independently disable themselves and
 * show a busy label while their own IPC call is in flight, and surface an inline error message on
 * failure instead of failing silently -- per the `pdf-export`/`printing` capabilities. */
export function PreviewScreen() {
  const setViewMode = useEPPStore((state) => state.setViewMode);
  const exportPdf = useEPPStore((state) => state.exportPdf);
  const printDocument = useEPPStore((state) => state.printDocument);
  const [exportState, setExportState] = useState<ActionState>(IDLE_ACTION_STATE);
  const [printState, setPrintState] = useState<ActionState>(IDLE_ACTION_STATE);

  const handleExportPdf = async () => {
    if (exportState.status === 'busy') {
      return;
    }
    setExportState({ status: 'busy' });
    try {
      await exportPdf();
      setExportState(IDLE_ACTION_STATE);
    } catch (error) {
      setExportState({ status: 'error', message: describeActionError(error, 'Could not export the PDF.') });
    }
  };

  const handlePrint = async () => {
    if (printState.status === 'busy') {
      return;
    }
    setPrintState({ status: 'busy' });
    try {
      await printDocument();
      setPrintState(IDLE_ACTION_STATE);
    } catch (error) {
      setPrintState({ status: 'error', message: describeActionError(error, 'Could not print the document.') });
    }
  };

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
          {exportState.status === 'error' && <span className="text-sm text-rose-400">{exportState.message}</span>}
          {printState.status === 'error' && <span className="text-sm text-rose-400">{printState.message}</span>}
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={exportState.status === 'busy'}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exportState.status === 'busy' ? 'Exporting…' : 'Export PDF'}
          </button>
          <button
            type="button"
            onClick={() => void handlePrint()}
            disabled={printState.status === 'busy'}
            className="rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {printState.status === 'busy' ? 'Printing…' : 'Print'}
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
