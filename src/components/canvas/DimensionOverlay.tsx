// @spec OPENSPEC.md §4.1, §4.1.1, §4.1.1.1 — hover-triggered dimension labels for imageSlot boxes (slot size + assigned image size)
interface DimensionOverlayProps {
  showSlotLabel: boolean;
  slotLabel: string;
  showImageLabel: boolean;
  imageLabel?: string;
  /** When true the image label ignores `showImageLabel` and stays visible, with a lock icon — the size is pinned via "Specific size" and no longer follows the slot's own size. */
  imageLabelLocked?: boolean;
}

export function DimensionOverlay({ showSlotLabel, slotLabel, showImageLabel, imageLabel, imageLabelLocked = false }: DimensionOverlayProps) {
  const shouldShowImageLabel = imageLabelLocked || showImageLabel;

  return (
    <>
      {showSlotLabel ? (
        <span className="pointer-events-none absolute right-2 top-2 z-20 rounded-full bg-slate-950/85 px-2 py-1 text-[10px] font-semibold text-slate-300">
          {slotLabel}
        </span>
      ) : null}
      {shouldShowImageLabel && imageLabel ? (
        <span className="pointer-events-none absolute bottom-2 left-2 z-20 flex items-center gap-1 rounded-full bg-slate-950/85 px-2 py-1 text-[10px] font-semibold text-amber-300">
          {imageLabel}
          {imageLabelLocked ? <span aria-hidden="true">🔒</span> : null}
        </span>
      ) : null}
    </>
  );
}
