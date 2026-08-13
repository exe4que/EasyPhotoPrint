import {
  MIN_FREEFORM_SIZE_MM,
  type FocalPoint,
  type FreeformElement,
  type FreeformTransform,
  type ImageAsset,
  type ScalingRule,
  type SpecificSizeMm,
} from '@epp/layout-engine';
import { useRef, useState } from 'react';

import { computeImageDisplayRectMm } from '../../lib/imageDisplay.js';
import { formatLength, mmToPx, pxToMm, type UnitSystem } from '../../lib/units.js';
import { DimensionOverlay } from './DimensionOverlay.js';
import { SlotImage } from './SlotImage.js';

function normalizeRotationDeg(deg: number): number {
  return (((deg + 180) % 360) + 360) % 360 - 180;
}

interface FreeformElementViewProps {
  element: FreeformElement;
  /** Added to transform.xMm/yMm to re-base into the (padding-clipped) rendering wrapper's origin. */
  offsetXMm: number;
  offsetYMm: number;
  asset: ImageAsset | undefined;
  scalingRule: ScalingRule | undefined;
  specificSizeMm?: SpecificSizeMm;
  focalPoint?: FocalPoint;
  isSelected: boolean;
  previewZoom: number;
  unitSystem: UnitSystem;
  onSelect: () => void;
  onRemove: () => void;
  onTransform: (patch: Partial<FreeformTransform>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

interface MoveDragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startXMm: number;
  startYMm: number;
}

interface ResizeDragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startWidth: number;
  startHeight: number;
  aspectLocked: boolean;
}

interface RotateDragState {
  pointerId: number;
  centerX: number;
  centerY: number;
}

export function FreeformElementView({
  element,
  offsetXMm,
  offsetYMm,
  asset,
  scalingRule,
  specificSizeMm,
  focalPoint,
  isSelected,
  previewZoom,
  unitSystem,
  onSelect,
  onRemove,
  onTransform,
  onDragStart,
  onDragEnd,
}: FreeformElementViewProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isHoveredImage, setIsHoveredImage] = useState(false);
  const { xMm, yMm, widthMm, heightMm, rotationDeg, lockAspectRatio } = element.transform;

  // Each gesture's start-of-drag values live in a ref (not state, since they drive synchronous
  // per-event math, not a render) set at pointerdown and read by that same gesture's move/end
  // handlers -- the React-idiomatic equivalent of the closures the old window-listener version
  // captured fresh on every mousedown. Checking pointerId (not just "is a drag active") means a
  // second finger touching the same handle mid-drag is ignored rather than corrupting it.
  const moveDragRef = useRef<MoveDragState | null>(null);
  const resizeDragRef = useRef<ResizeDragState | null>(null);
  const rotateDragRef = useRef<RotateDragState | null>(null);

  const handleMovePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    onSelect();

    event.currentTarget.setPointerCapture(event.pointerId);
    moveDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startXMm: xMm,
      startYMm: yMm,
    };
    onDragStart();
  };

  const handleMovePointerMove = (event: React.PointerEvent) => {
    const drag = moveDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    onTransform({
      xMm: drag.startXMm + pxToMm(event.clientX - drag.startClientX, previewZoom),
      yMm: drag.startYMm + pxToMm(event.clientY - drag.startClientY, previewZoom),
    });
  };

  const handleMovePointerEnd = (event: React.PointerEvent) => {
    const drag = moveDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    moveDragRef.current = null;
    onDragEnd();
  };

  const handleResizePointerDown = (event: React.PointerEvent) => {
    event.stopPropagation();
    event.preventDefault();

    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: widthMm,
      startHeight: heightMm,
      aspectLocked: lockAspectRatio ?? true,
    };
    onDragStart();
  };

  const handleResizePointerMove = (event: React.PointerEvent) => {
    const drag = resizeDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const deltaWidthMm = pxToMm(event.clientX - drag.startClientX, previewZoom);
    const nextWidth = Math.max(MIN_FREEFORM_SIZE_MM, drag.startWidth + deltaWidthMm);
    const nextHeight = drag.aspectLocked
      ? Math.max(MIN_FREEFORM_SIZE_MM, drag.startHeight * (nextWidth / drag.startWidth))
      : Math.max(MIN_FREEFORM_SIZE_MM, drag.startHeight + pxToMm(event.clientY - drag.startClientY, previewZoom));
    onTransform({ widthMm: nextWidth, heightMm: nextHeight });
  };

  const handleResizePointerEnd = (event: React.PointerEvent) => {
    const drag = resizeDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    resizeDragRef.current = null;
    onDragEnd();
  };

  const handleRotatePointerDown = (event: React.PointerEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    rotateDragRef.current = {
      pointerId: event.pointerId,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };
    onDragStart();
  };

  const handleRotatePointerMove = (event: React.PointerEvent) => {
    const drag = rotateDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const angleDeg = (Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX) * 180) / Math.PI + 90;
    onTransform({ rotationDeg: normalizeRotationDeg(angleDeg) });
  };

  const handleRotatePointerEnd = (event: React.PointerEvent) => {
    const drag = rotateDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    rotateDragRef.current = null;
    onDragEnd();
  };

  const displayRect = asset
    ? computeImageDisplayRectMm(asset, { x: 0, y: 0, w: widthMm, h: heightMm }, scalingRule, specificSizeMm)
    : null;
  const isSpecificSize = scalingRule === 'specificSize' && !!specificSizeMm;

  return (
    <div
      className="absolute"
      // The freeformCanvas layer behind this element treats any click as "place a new
      // element here" — stop every click originating from this element (body, handles,
      // remove button) from bubbling there, or interacting with an element would also drop
      // a stray new one underneath it.
      onClick={(event) => event.stopPropagation()}
      style={{
        left: mmToPx(xMm + offsetXMm, previewZoom),
        top: mmToPx(yMm + offsetYMm, previewZoom),
        width: mmToPx(widthMm, previewZoom),
        height: mmToPx(heightMm, previewZoom),
        transform: `rotate(${rotationDeg}deg)`,
        transformOrigin: 'center',
        zIndex: isSelected ? 30 : (element.zIndex ?? 0) + 1,
      }}
    >
      <div
        ref={contentRef}
        role="button"
        tabIndex={0}
        onPointerDown={handleMovePointerDown}
        onPointerMove={handleMovePointerMove}
        onPointerUp={handleMovePointerEnd}
        onPointerCancel={handleMovePointerEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsHoveredImage(false);
        }}
        onMouseMove={(event) => {
          if (!displayRect) {
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          const localX = event.clientX - rect.left;
          const localY = event.clientY - rect.top;
          setIsHoveredImage(
            localX >= mmToPx(displayRect.offsetXMm, previewZoom) &&
              localX <= mmToPx(displayRect.offsetXMm + displayRect.widthMm, previewZoom) &&
              localY >= mmToPx(displayRect.offsetYMm, previewZoom) &&
              localY <= mmToPx(displayRect.offsetYMm + displayRect.heightMm, previewZoom),
          );
        }}
        className={`relative h-full w-full touch-none cursor-move overflow-hidden rounded-md border ${
          isSelected ? 'border-cyan-500 ring-2 ring-cyan-500/40' : 'border-white/50 hover:border-white'
        }`}
      >
        {asset ? (
          <SlotImage
            asset={asset}
            widthMm={widthMm}
            heightMm={heightMm}
            scalingRule={scalingRule}
            specificSizeMm={specificSizeMm}
            focalPoint={focalPoint}
            rotationDeg={undefined}
            zoom={previewZoom}
            unsatisfiedSizeContext="element"
            showDiagnostics
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-800/80 text-[10px] text-slate-400">Empty</div>
        )}

        <DimensionOverlay
          showSlotLabel={isHovered}
          slotLabel={`${formatLength(widthMm, unitSystem)} × ${formatLength(heightMm, unitSystem)}`}
          showImageLabel={isHoveredImage}
          imageLabelLocked={isSpecificSize}
          imageLabel={
            displayRect ? `${formatLength(displayRect.widthMm, unitSystem)} × ${formatLength(displayRect.heightMm, unitSystem)}` : undefined
          }
        />
      </div>

      {isSelected ? (
        <>
          <button
            type="button"
            aria-label="Remove element"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            className="absolute -left-2.5 -top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-slate-950/90 text-xs font-semibold text-white hover:bg-rose-600"
          >
            ×
          </button>
          <div
            role="presentation"
            onPointerDown={handleRotatePointerDown}
            onPointerMove={handleRotatePointerMove}
            onPointerUp={handleRotatePointerEnd}
            onPointerCancel={handleRotatePointerEnd}
            className="absolute left-1/2 -top-7 z-10 h-4 w-4 -translate-x-1/2 touch-none cursor-grab rounded-full border-2 border-white bg-cyan-500"
          />
          <div
            role="presentation"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerEnd}
            onPointerCancel={handleResizePointerEnd}
            className="absolute -bottom-1.5 -right-1.5 z-10 h-4 w-4 touch-none cursor-nwse-resize rounded-sm border-2 border-white bg-cyan-500"
          />
        </>
      ) : null}
    </div>
  );
}
