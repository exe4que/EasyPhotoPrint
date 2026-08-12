import { useEPPStore } from '../../store/index.js';

/** Full-viewport blocking overlay shown while adding images to the library, exporting to PDF, or
 * printing (see the `processing-overlay` capability). Mounted once at the app root; its backdrop
 * captures every pointer event so nothing behind it is clickable while visible. */
export function ProcessingOverlay() {
  const visible = useEPPStore((state) => state.ui.processingOverlay.visible);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Processing…"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70"
    >
      <div
        aria-hidden="true"
        className="h-12 w-12 animate-spin rounded-full border-4 border-slate-600 border-t-cyan-400"
      />
    </div>
  );
}
