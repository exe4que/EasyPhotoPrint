// @spec OPENSPEC.md §1.3, §2.3 — current slot/image selection feedback for basic grid assignment
import { useMemo } from 'react';

import { useEPPStore } from '../../store/index.js';
import { CollapsiblePanel } from '../ui/CollapsiblePanel.js';

interface SelectionPanelProps {
  selectedImageAssetId: string | null;
  onClearSelectedImage: () => void;
}

export function SelectionPanel({ selectedImageAssetId, onClearSelectedImage }: SelectionPanelProps) {
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const selectedSlotId = useEPPStore((state) => state.ui.selectedElementIds[0] ?? null);
  const activePage = useEPPStore(
    (state) => state.document.pages.find((page) => page.id === activePageId) ?? state.document.pages[0],
  );
  const imagePool = useEPPStore((state) => state.imagePool);
  const selectedAsset = useMemo(
    () => imagePool.find((asset) => asset.id === selectedImageAssetId) ?? null,
    [imagePool, selectedImageAssetId],
  );
  const assignedAsset = selectedSlotId ? imagePool.find((asset) => asset.id === activePage.assignments[selectedSlotId]) : null;

  return (
    <CollapsiblePanel title="Selection" defaultCollapsed={false}>
      <div className="space-y-3 text-sm">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Selected slot</div>
          <div className="mt-1 font-medium text-white">{selectedSlotId ?? 'None'}</div>
          <div className="mt-1 text-xs text-slate-400">
            {assignedAsset
              ? assignedAsset.fileName
              : selectedSlotId
                ? 'No image assigned yet.'
                : 'Select a slot to edit its scaling rule. In Simple mode, clearing the selection returns the inspector to the root container.'}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Selected library image</div>
          <div className="mt-1 font-medium text-white">{selectedAsset?.fileName ?? 'None'}</div>
          <div className="mt-1 text-xs text-slate-400">
            {selectedAsset ? `${selectedAsset.widthPx}×${selectedAsset.heightPx}` : 'Click a thumbnail to see its details, or drag it to a slot to assign it.'}
          </div>
        </div>
      </div>

      {selectedImageAssetId ? (
        <button
          type="button"
          onClick={onClearSelectedImage}
          className="mt-4 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-600"
        >
          Clear selected image
        </button>
      ) : null}
    </CollapsiblePanel>
  );
}
