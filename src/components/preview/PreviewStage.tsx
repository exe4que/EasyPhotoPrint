import type { BoxMm, ImageAsset, ImageSlotConfig, LayoutNode } from '@epp/layout-engine';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLayoutResolution } from '../../hooks/useLayoutResolution.js';
import { usePrintResolutionSrc } from '../../hooks/usePrintResolutionSrc.js';
import { mmToPx } from '../../lib/units.js';
import { useEPPStore } from '../../store/index.js';
import { SlotImage } from '../canvas/SlotImage.js';

const PREVIEW_ZOOM_FALLBACK = 0.38;
const PREVIEW_INNER_PADDING_PX = 48;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function collectImageSlotNodes(node: LayoutNode): LayoutNode[] {
  const nodes = node.type === 'imageSlot' ? [node] : [];
  for (const child of node.children ?? []) {
    nodes.push(...collectImageSlotNodes(child));
  }
  return nodes;
}

function collectFreeformCanvasNodes(node: LayoutNode): LayoutNode[] {
  const nodes = node.type === 'freeformCanvas' ? [node] : [];
  for (const child of node.children ?? []) {
    nodes.push(...collectFreeformCanvasNodes(child));
  }
  return nodes;
}

/** A single placed imageSlot's image, at print resolution once available (falling back to the
 * asset's thumbnail while it loads) -- its own component because usePrintResolutionSrc is a hook
 * and this is rendered from inside a .map(). */
function PreviewImageSlot({
  box,
  asset,
  imageSlotConfig,
  zoom,
  dpi,
}: {
  box: BoxMm;
  asset: ImageAsset;
  imageSlotConfig: ImageSlotConfig | undefined;
  zoom: number;
  dpi: number;
}) {
  const srcOverride = usePrintResolutionSrc(asset, box.w, box.h, dpi);

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: mmToPx(box.x, zoom),
        top: mmToPx(box.y, zoom),
        width: mmToPx(box.w, zoom),
        height: mmToPx(box.h, zoom),
      }}
    >
      <SlotImage
        asset={asset}
        widthMm={box.w}
        heightMm={box.h}
        scalingRule={imageSlotConfig?.scalingRule}
        specificSizeMm={imageSlotConfig?.specificSizeMm}
        rotationDeg={imageSlotConfig?.imageRotationDeg}
        zoom={zoom}
        unsatisfiedSizeContext="slot"
        showDiagnostics={false}
        srcOverride={srcOverride}
      />
    </div>
  );
}

/** A single freeform element's image, at print resolution once available -- same reasoning as
 * PreviewImageSlot. */
function PreviewFreeformImage({
  elementId,
  elementZIndex,
  asset,
  widthMm,
  heightMm,
  xMm,
  yMm,
  rotationDeg,
  offsetXMm,
  offsetYMm,
  imageSlotConfig,
  zoom,
  dpi,
}: {
  elementId: string;
  elementZIndex: number | undefined;
  asset: ImageAsset;
  widthMm: number;
  heightMm: number;
  xMm: number;
  yMm: number;
  rotationDeg: number;
  offsetXMm: number;
  offsetYMm: number;
  imageSlotConfig: ImageSlotConfig | undefined;
  zoom: number;
  dpi: number;
}) {
  const srcOverride = usePrintResolutionSrc(asset, widthMm, heightMm, dpi);

  return (
    <div
      key={elementId}
      className="absolute overflow-hidden"
      style={{
        left: mmToPx(xMm + offsetXMm, zoom),
        top: mmToPx(yMm + offsetYMm, zoom),
        width: mmToPx(widthMm, zoom),
        height: mmToPx(heightMm, zoom),
        transform: `rotate(${rotationDeg}deg)`,
        transformOrigin: 'center',
        // Matches the editor's stacking order (FreeformElement.tsx) so overlapping
        // elements paint in the same order in preview -- element.zIndex isn't
        // reassigned on delete, so array order alone can drift from it over time.
        zIndex: (elementZIndex ?? 0) + 1,
      }}
    >
      <SlotImage
        asset={asset}
        widthMm={widthMm}
        heightMm={heightMm}
        scalingRule={imageSlotConfig?.scalingRule}
        specificSizeMm={imageSlotConfig?.specificSizeMm}
        rotationDeg={undefined}
        zoom={zoom}
        unsatisfiedSizeContext="element"
        showDiagnostics={false}
        srcOverride={srcOverride}
      />
    </div>
  );
}

/**
 * The full-screen, gizmo-free rendering of the active page for print-preview: no slot borders,
 * badges, hover states, drag-and-drop, dividers, or padding outline -- just the page at
 * fit-to-screen zoom with every placed image rendered exactly as the editor renders it (via the
 * same `SlotImage` the editor canvas uses), at print resolution rather than the Image Library's
 * bounded-edge thumbnail. Unassigned slots and empty freeform elements render as nothing.
 */
export function PreviewStage() {
  const { page, pageBox, layout } = useLayoutResolution();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(PREVIEW_ZOOM_FALLBACK);
  const imagePool = useEPPStore((state) => state.imagePool);
  const imageAssetMap = new Map(imagePool.map((asset) => [asset.id, asset]));
  const imageSlots = collectImageSlotNodes(page.rootNode);
  const imageSlotMap = new Map(imageSlots.map((node) => [node.id, node]));
  const freeformCanvasNodes = collectFreeformCanvasNodes(page.rootNode);
  const dpi = page.pageConfig.dpi;
  const pageWidthAtZoomOne = mmToPx(pageBox.w, 1);
  const pageHeightAtZoomOne = mmToPx(pageBox.h, 1);
  const pageWidthPx = mmToPx(pageBox.w, zoom);
  const pageHeightPx = mmToPx(pageBox.h, zoom);

  const computeFitZoom = useCallback((): number | null => {
    const element = viewportRef.current;
    if (!element) {
      return null;
    }

    const availableWidth = Math.max(1, element.clientWidth - PREVIEW_INNER_PADDING_PX);
    const availableHeight = Math.max(1, element.clientHeight - PREVIEW_INNER_PADDING_PX);
    const widthZoom = availableWidth / pageWidthAtZoomOne;
    const heightZoom = availableHeight / pageHeightAtZoomOne;
    return clampZoom(Math.min(widthZoom, heightZoom));
  }, [pageWidthAtZoomOne, pageHeightAtZoomOne]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const recomputeZoom = () => {
      const fitZoom = computeFitZoom();
      if (fitZoom != null) {
        setZoom(fitZoom);
      }
    };

    recomputeZoom();
    const observer = new ResizeObserver(recomputeZoom);
    observer.observe(element);
    return () => observer.disconnect();
  }, [computeFitZoom]);

  return (
    <div ref={viewportRef} className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
      <div
        className="relative shrink-0 bg-white shadow-2xl"
        style={{ width: pageWidthPx, height: pageHeightPx }}
      >
        {Array.from(layout.entries())
          .filter(([id]) => imageSlotMap.has(id) && (id !== page.rootNode.id || page.rootNode.type === 'imageSlot'))
          .map(([id, box]) => {
            const assetId = page.assignments[id];
            const asset = assetId ? imageAssetMap.get(assetId) : undefined;
            if (!asset) {
              return null;
            }

            return (
              <PreviewImageSlot
                key={id}
                box={box}
                asset={asset}
                imageSlotConfig={imageSlotMap.get(id)?.imageSlotConfig}
                zoom={zoom}
                dpi={dpi}
              />
            );
          })}

        {freeformCanvasNodes.flatMap((freeformCanvasNode) => {
          const box = layout.get(freeformCanvasNode.id);
          if (!box) {
            return [];
          }

          const padding = freeformCanvasNode.paddingMm ?? {};
          const paddingTopPx = mmToPx(padding.top ?? 0, zoom);
          const paddingRightPx = mmToPx(padding.right ?? 0, zoom);
          const paddingBottomPx = mmToPx(padding.bottom ?? 0, zoom);
          const paddingLeftPx = mmToPx(padding.left ?? 0, zoom);
          const offsetXMm = -(padding.left ?? 0);
          const offsetYMm = -(padding.top ?? 0);

          return (
            <div
              key={`freeform-${freeformCanvasNode.id}`}
              className="absolute overflow-hidden"
              style={{
                left: mmToPx(box.x, zoom) + paddingLeftPx,
                top: mmToPx(box.y, zoom) + paddingTopPx,
                width: mmToPx(box.w, zoom) - paddingLeftPx - paddingRightPx,
                height: mmToPx(box.h, zoom) - paddingTopPx - paddingBottomPx,
              }}
            >
              {(freeformCanvasNode.freeformElements ?? []).map((element) => {
                const asset = imageAssetMap.get(page.assignments[element.imageNodeId] ?? '');
                if (!asset) {
                  return null;
                }

                return (
                  <PreviewFreeformImage
                    key={element.id}
                    elementId={element.id}
                    elementZIndex={element.zIndex}
                    asset={asset}
                    widthMm={element.transform.widthMm}
                    heightMm={element.transform.heightMm}
                    xMm={element.transform.xMm}
                    yMm={element.transform.yMm}
                    rotationDeg={element.transform.rotationDeg}
                    offsetXMm={offsetXMm}
                    offsetYMm={offsetYMm}
                    imageSlotConfig={imageSlotMap.get(element.imageNodeId)?.imageSlotConfig}
                    zoom={zoom}
                    dpi={dpi}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
