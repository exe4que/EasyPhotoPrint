import type { ImageAsset, ImageRotationDeg, ScalingRule, SpecificSizeMm } from '@epp/layout-engine';

import { computeImageRenderRectMm, isSpecificSizeUnsatisfied, scalingRuleToObjectFit } from '../../lib/imageDisplay.js';
import { mmToPx } from '../../lib/units.js';

interface SlotImageProps {
  asset: ImageAsset;
  widthMm: number;
  heightMm: number;
  scalingRule: ScalingRule | undefined;
  specificSizeMm: SpecificSizeMm | undefined;
  rotationDeg: ImageRotationDeg | undefined;
  zoom: number;
  /** Which noun the "specific size doesn't fit" tooltip uses — grid/flex imageSlots vs. freeform elements word it differently. */
  unsatisfiedSizeContext: 'slot' | 'element';
  /** Authoring-time warnings (the unsatisfied-size outline/tooltip, the "Image missing" badge) --
   * neither would ever appear on the printed page. Editor callers (PageStage, FreeformElementView)
   * pass true; the print-preview screen passes false so it stays free of every editing gizmo,
   * rendering a missing image's slot the same blank way an unassigned slot renders. */
  showDiagnostics: boolean;
  /** A higher-resolution data URL to display instead of `asset.thumbnailDataUrl` (which is always
   * bounded to a small edge -- see project-persistence's thumbnail contract). Editor callers omit
   * this and keep using the thumbnail; print-preview passes a print-resolution decode once one is
   * available, falling back to the thumbnail while it loads. Purely which bitmap is displayed --
   * every geometry/aspect-ratio calculation below is unaffected, since it's derived from `asset`. */
  srcOverride?: string;
}

/**
 * Presentation-only: given an asset and the box it's placed in, renders exactly the pixels an
 * editor slot or freeform element would show — no click/hover/drag handlers, no selection
 * border, no dimension overlay. Shared by the interactive editor canvas (PageStage,
 * FreeformElementView) and the print-preview screen so both can never draw an image differently.
 */
export function SlotImage({
  asset,
  widthMm,
  heightMm,
  scalingRule,
  specificSizeMm,
  rotationDeg,
  zoom,
  unsatisfiedSizeContext,
  showDiagnostics,
  srcOverride,
}: SlotImageProps) {
  if (asset.missing) {
    if (!showDiagnostics) {
      return null;
    }
    return (
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-amber-500/50 bg-amber-950/30 px-2 text-center">
        <span className="text-lg font-semibold text-amber-400">!</span>
        <span className="text-[11px] font-medium text-amber-300">Image missing</span>
        <span className="truncate text-[10px] text-amber-200/70">{asset.fileName}</span>
      </div>
    );
  }

  const slotBox = { x: 0, y: 0, w: widthMm, h: heightMm };
  const unsatisfied = showDiagnostics && scalingRule === 'specificSize' && isSpecificSizeUnsatisfied(specificSizeMm, slotBox);
  // Pre-rotation size, centered on the slot's own center then CSS-rotated -- the rotated
  // bounding box lands exactly on the slot with no offset math. At 90/270, this is routinely
  // wider than the slot itself (that's the point -- it's staged to become the slot's height
  // once rotated), so the <img> below must override the base stylesheet's `max-width: 100%`,
  // or the browser clips it to the slot's own width *before* rotating, corrupting the layout.
  const renderRect = computeImageRenderRectMm(asset, slotBox, scalingRule, specificSizeMm, rotationDeg);
  const renderLeftMm = widthMm / 2 - renderRect.widthMm / 2;
  const renderTopMm = heightMm / 2 - renderRect.heightMm / 2;
  const rotationTransform = rotationDeg ? `rotate(${rotationDeg}deg)` : undefined;
  const unsatisfiedNoun = unsatisfiedSizeContext === 'slot' ? 'slot' : 'elemento';
  const src = srcOverride ?? asset.thumbnailDataUrl;

  if (scalingRule === 'specificSize' && specificSizeMm) {
    return (
      <img
        src={src}
        alt={asset.fileName}
        title={unsatisfied ? `El tamaño específico no entra en el espacio disponible del ${unsatisfiedNoun}` : undefined}
        className={`pointer-events-none absolute object-fill ${
          unsatisfied ? 'outline outline-2 outline-offset-[-2px] outline-rose-500' : ''
        }`}
        style={{
          left: mmToPx(renderLeftMm, zoom),
          top: mmToPx(renderTopMm, zoom),
          width: mmToPx(renderRect.widthMm, zoom),
          height: mmToPx(renderRect.heightMm, zoom),
          maxWidth: 'none',
          maxHeight: 'none',
          transform: rotationTransform,
          transformOrigin: 'center',
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={asset.fileName}
      className="pointer-events-none absolute"
      style={{
        left: mmToPx(renderLeftMm, zoom),
        top: mmToPx(renderTopMm, zoom),
        width: mmToPx(renderRect.widthMm, zoom),
        height: mmToPx(renderRect.heightMm, zoom),
        maxWidth: 'none',
        maxHeight: 'none',
        objectFit: scalingRuleToObjectFit(scalingRule),
        transform: rotationTransform,
        transformOrigin: 'center',
      }}
    />
  );
}
