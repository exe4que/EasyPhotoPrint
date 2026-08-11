import { isSimpleModeCompatible } from '@epp/layout-engine';

import { useLayoutResolution } from '../../hooks/useLayoutResolution.js';
import { formatLength } from '../../lib/units.js';
import { useEPPStore } from '../../store/index.js';

/** The read-only document stats (page count, layout mode, image pool size, page size, orientation)
 * plus the Simple/Nested mode toggle -- shared between `DesktopShell` (which wraps this in its own
 * "Document" `CollapsiblePanel`) and `MobileShell`'s Layout tab sheet (which renders this bare, since
 * the sheet chrome already supplies a title). No `CollapsiblePanel` of its own: whether and how this
 * gets a header is the caller's decision, per design.md Decision 4. */
export function DocumentSummary() {
  const unitSystem = useEPPStore((state) => state.settings.unitSystem);
  const layoutMode = useEPPStore((state) => state.ui.layoutMode);
  const setLayoutMode = useEPPStore((state) => state.setLayoutMode);
  const normalizePageForSimpleMode = useEPPStore((state) => state.normalizePageForSimpleMode);
  const imagePool = useEPPStore((state) => state.imagePool);
  const imageCount = imagePool.length;
  const pageCount = useEPPStore((state) => state.document.pages.length);
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const { pageBox, page } = useLayoutResolution();
  const isSimpleModeAvailable = isSimpleModeCompatible(page.rootNode);

  return (
    <>
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
    </>
  );
}
