import type { ImageAsset } from '@epp/layout-engine';
import { useMemo, useState } from 'react';

import { useDragAndDrop } from '../../hooks/useDragAndDrop.js';
import type { LibraryImageDragGesture } from '../../hooks/useLibraryImageDragGesture.js';
import { useEPPStore } from '../../store/index.js';
import { CollapsiblePanel } from '../ui/CollapsiblePanel.js';

function countAssignments(assignments: Record<string, string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const imageAssetId of Object.values(assignments)) {
    counts.set(imageAssetId, (counts.get(imageAssetId) ?? 0) + 1);
  }
  return counts;
}

function ImageCard({
  asset,
  isSelected,
  assignmentsOnPage,
  onSelect,
  onRelink,
  dragProps,
  dragGesture,
}: {
  asset: ImageAsset;
  isSelected: boolean;
  assignmentsOnPage: number;
  onSelect: () => void;
  onRelink: () => void;
  dragProps: ReturnType<ReturnType<typeof useDragAndDrop>['createImageDragProps']>;
  /** Mobile-shell-only pointer drag gesture (see `useLibraryImageDragGesture`). Absent on desktop,
   * where the existing HTML5 `dragProps` above is the only drag mechanism. */
  dragGesture?: LibraryImageDragGesture;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`group relative w-36 flex-none overflow-hidden rounded-xl border text-left transition ${
        isSelected
          ? 'border-cyan-500 ring-2 ring-cyan-500/30'
          : 'border-slate-800 hover:border-slate-600'
      }`}
      // pan-x (not none, not the default auto): lets the panel's own native horizontal scroll keep
      // working, but keeps the browser from ever claiming a vertical swipe as a native pan/scroll
      // gesture -- without that, the browser cancels the whole pointer sequence (no more events
      // reach any listener, window-level or not) the moment it decides a vertical touch might be a
      // scroll attempt, even one that immediately has nowhere to go, well before our own
      // isInsidePanel check ever gets a chance to see the pointer leave the panel.
      style={dragGesture ? { touchAction: 'pan-x' } : undefined}
      {...(dragGesture ? dragGesture.createCardDragProps(asset.id) : dragProps)}
    >
      <div className="aspect-square bg-slate-950">
        {/* draggable=false overrides the browser's default-draggable <img> behavior, which would
         * otherwise start a native image drag on the very first pointermove and swallow the rest
         * of the gesture -- desktop's own HTML5 drag is unaffected since it's driven by this
         * card's outer div (dragProps above), not this element. */}
        <img
          src={asset.thumbnailDataUrl}
          alt={asset.fileName}
          draggable={false}
          className="h-full w-full object-contain"
        />
      </div>

      <div className="space-y-1 bg-slate-900/90 p-2">
        <div className="truncate text-xs font-medium text-white">{asset.fileName}</div>
        {asset.missing ? (
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold uppercase tracking-wide text-amber-400">Missing</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRelink();
              }}
              className="whitespace-nowrap rounded-full border border-cyan-500/60 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200 hover:bg-cyan-500/20"
            >
              Locate...
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{`${asset.widthPx}×${asset.heightPx}`}</span>
            <span>{assignmentsOnPage > 0 ? `${assignmentsOnPage} used` : 'unused'}</span>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2">
        <span className="rounded-full bg-slate-950/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
          Drag
        </span>
        {isSelected ? (
          <span className="rounded-full bg-cyan-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-950">
            Selected
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ImageLibraryPanel({
  bare = false,
  dragGesture,
}: {
  bare?: boolean;
  /** Passed by `MobileShell` only -- see `ImageCard`'s own `dragGesture` prop. */
  dragGesture?: LibraryImageDragGesture;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const imagePool = useEPPStore((state) => state.imagePool);
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const selection = useEPPStore((state) => state.ui.selection);
  const setSelection = useEPPStore((state) => state.setSelection);
  const selectedImageAssetId = selection?.kind === 'image' ? selection.id : null;
  const activePage = useEPPStore(
    (state) => state.document.pages.find((page) => page.id === activePageId) ?? state.document.pages[0],
  );
  const openImagesFromDialog = useEPPStore((state) => state.openImagesFromDialog);
  const relinkImage = useEPPStore((state) => state.relinkImage);
  const showProcessingOverlay = useEPPStore((state) => state.showProcessingOverlay);
  const hideProcessingOverlay = useEPPStore((state) => state.hideProcessingOverlay);
  const { createImageDragProps } = useDragAndDrop();
  const assignmentCounts = useMemo(() => countAssignments(activePage.assignments), [activePage.assignments]);

  const handleOpenImages = async () => {
    setErrorMessage(null);
    showProcessingOverlay();
    try {
      await openImagesFromDialog();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load the selected images.');
    } finally {
      hideProcessingOverlay();
    }
  };

  return (
    <CollapsiblePanel
      title="Image library"
      description="Load images from the native dialog, then drag them into the grid slots. Click an image to view its details in the Properties panel."
      defaultCollapsed={false}
      bare={bare}
      headerAction={
        <button
          type="button"
          onClick={() => void handleOpenImages()}
          className="whitespace-nowrap rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
        >
          Load images
        </button>
      }
    >

      {errorMessage ? (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      {imagePool.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-400">
          No images loaded yet.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-1">
          {imagePool.map((asset) => {
            const isSelected = asset.id === selectedImageAssetId;
            return (
              <ImageCard
                key={asset.id}
                asset={asset}
                isSelected={isSelected}
                assignmentsOnPage={assignmentCounts.get(asset.id) ?? 0}
                dragProps={createImageDragProps(asset.id)}
                dragGesture={dragGesture}
                onSelect={() => setSelection(isSelected ? null : { kind: 'image', id: asset.id })}
                onRelink={() => void relinkImage(asset.id)}
              />
            );
          })}
        </div>
      )}
    </CollapsiblePanel>
  );
}
