import {
  MIN_FREEFORM_SIZE_MM,
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
  isSelected: boolean;
  previewZoom: number;
  unitSystem: UnitSystem;
  onSelect: () => void;
  onRemove: () => void;
  onTransform: (patch: Partial<FreeformTransform>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function FreeformElementView({
  element,
  offsetXMm,
  offsetYMm,
  asset,
  scalingRule,
  specificSizeMm,
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

  const startMoveDrag = (event: React.MouseEvent) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    onSelect();

    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startXMm = xMm;
    const startYMm = yMm;
    onDragStart();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      onTransform({
        xMm: startXMm + pxToMm(moveEvent.clientX - startClientX, previewZoom),
        yMm: startYMm + pxToMm(moveEvent.clientY - startClientY, previewZoom),
      });
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      onDragEnd();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const startResizeDrag = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startWidth = widthMm;
    const startHeight = heightMm;
    const aspectLocked = lockAspectRatio ?? true;
    onDragStart();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaWidthMm = pxToMm(moveEvent.clientX - startClientX, previewZoom);
      const nextWidth = Math.max(MIN_FREEFORM_SIZE_MM, startWidth + deltaWidthMm);
      const nextHeight = aspectLocked
        ? Math.max(MIN_FREEFORM_SIZE_MM, startHeight * (nextWidth / startWidth))
        : Math.max(MIN_FREEFORM_SIZE_MM, startHeight + pxToMm(moveEvent.clientY - startClientY, previewZoom));
      onTransform({ widthMm: nextWidth, heightMm: nextHeight });
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      onDragEnd();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const startRotateDrag = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    onDragStart();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const angleDeg = (Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * 180) / Math.PI + 90;
      onTransform({ rotationDeg: normalizeRotationDeg(angleDeg) });
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      onDragEnd();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
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
        onMouseDown={startMoveDrag}
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
        className={`relative h-full w-full cursor-move overflow-hidden rounded-md border ${
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
            onMouseDown={startRotateDrag}
            className="absolute left-1/2 -top-7 z-10 h-4 w-4 -translate-x-1/2 cursor-grab rounded-full border-2 border-white bg-cyan-500"
          />
          <div
            role="presentation"
            onMouseDown={startResizeDrag}
            className="absolute -bottom-1.5 -right-1.5 z-10 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-cyan-500"
          />
        </>
      ) : null}
    </div>
  );
}
