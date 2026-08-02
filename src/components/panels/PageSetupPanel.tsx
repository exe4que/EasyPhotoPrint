// @spec OPENSPEC.md §2.3, §2.4 — per-page pageConfig inspector
import type { ReactNode } from 'react';

import { formatLength, parseLength } from '../../lib/units.js';
import { useEPPStore } from '../../store/index.js';
import { CollapsiblePanel } from '../ui/CollapsiblePanel.js';

const PAGE_SIZE_OPTIONS = ['A4', 'Letter', 'Legal', '4x6', '5x7', 'A3', 'Custom'] as const;

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{children}</label>;
}

export function PageSetupPanel() {
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const unitSystem = useEPPStore((state) => state.settings.unitSystem);
  const page = useEPPStore(
    (state) => state.document.pages.find((entry) => entry.id === activePageId) ?? state.document.pages[0],
  );
  const updatePageConfig = useEPPStore((state) => state.updatePageConfig);

  const customWidth = page.pageConfig.customSizeMm?.widthMm ?? 210;
  const customHeight = page.pageConfig.customSizeMm?.heightMm ?? 297;

  return (
    <CollapsiblePanel
      title="Page setup"
      description="`pageConfig` lives on each page and does not affect the rest of the document."
      defaultCollapsed={false}
    >
      <div className="grid gap-4">
        <div>
          <FieldLabel>Page size</FieldLabel>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={page.pageConfig.sizePreset}
            onChange={(event) =>
              updatePageConfig(page.id, {
                sizePreset: event.target.value as (typeof PAGE_SIZE_OPTIONS)[number],
              })
            }
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Orientation</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {(['portrait', 'landscape'] as const).map((orientation) => (
              <button
                key={orientation}
                type="button"
                onClick={() => updatePageConfig(page.id, { orientation })}
                className={`rounded-lg border px-3 py-2 text-sm capitalize ${
                  page.pageConfig.orientation === orientation
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'
                }`}
              >
                {orientation}
              </button>
            ))}
          </div>
        </div>

        {page.pageConfig.sizePreset === 'Custom' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Width</FieldLabel>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                defaultValue={formatLength(customWidth, unitSystem)}
                onBlur={(event) =>
                  updatePageConfig(page.id, {
                    customSizeMm: {
                      widthMm: parseLength(event.target.value, unitSystem),
                      heightMm: customHeight,
                    },
                  })
                }
              />
            </div>
            <div>
              <FieldLabel>Height</FieldLabel>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                defaultValue={formatLength(customHeight, unitSystem)}
                onBlur={(event) =>
                  updatePageConfig(page.id, {
                    customSizeMm: {
                      widthMm: customWidth,
                      heightMm: parseLength(event.target.value, unitSystem),
                    },
                  })
                }
              />
            </div>
          </div>
        ) : null}

        <div>
          <FieldLabel>DPI</FieldLabel>
          <input
            type="number"
            min={72}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={page.pageConfig.dpi}
            onChange={(event) => updatePageConfig(page.id, { dpi: Number(event.target.value) })}
          />
        </div>
      </div>
    </CollapsiblePanel>
  );
}
