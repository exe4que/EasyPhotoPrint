// @spec OPENSPEC.md §4.1 — hover-triggered dimension labels for imageSlot boxes (slot size + assigned image size)
interface DimensionOverlayProps {
  showSlotLabel: boolean;
  slotLabel: string;
  showImageLabel: boolean;
  imageLabel?: string;
}

export function DimensionOverlay({ showSlotLabel, slotLabel, showImageLabel, imageLabel }: DimensionOverlayProps) {
  return (
    <>
      {showSlotLabel ? (
        <span className="pointer-events-none absolute right-2 top-2 z-20 rounded-full bg-slate-950/85 px-2 py-1 text-[10px] font-semibold text-slate-300">
          {slotLabel}
        </span>
      ) : null}
      {showImageLabel && imageLabel ? (
        <span className="pointer-events-none absolute bottom-2 left-2 z-20 rounded-full bg-slate-950/85 px-2 py-1 text-[10px] font-semibold text-amber-300">
          {imageLabel}
        </span>
      ) : null}
    </>
  );
}
