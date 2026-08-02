// @spec OPENSPEC.md §1.3, §2.3, §4.1, §6.1 — page preview shell backed by the shared layout engine
import type { LayoutNode, ScalingRule } from '@epp/layout-engine';
import { useEffect, useRef, useState } from 'react';

import { useDragAndDrop } from '../../hooks/useDragAndDrop.js';
import { mmToPx } from '../../lib/units.js';
import { useLayoutResolution } from '../../hooks/useLayoutResolution.js';
import { useEPPStore } from '../../store/index.js';

const PREVIEW_ZOOM_FALLBACK = 0.38;
const PREVIEW_INNER_PADDING_PX = 48;

function collectImageSlotNodes(node: LayoutNode): LayoutNode[] {
  const nodes = node.type === 'imageSlot' ? [node] : [];
  for (const child of node.children ?? []) {
    nodes.push(...collectImageSlotNodes(child));
  }
  return nodes;
}

function scalingRuleToObjectFit(scalingRule: ScalingRule | undefined): 'contain' | 'cover' | 'fill' {
  switch (scalingRule) {
    case 'envelopeParent':
      return 'cover';
    case 'stretch':
      return 'fill';
    default:
      return 'contain';
  }
}

interface PageStageProps {
  selectedImageAssetId: string | null;
}

export function PageStage({ selectedImageAssetId }: PageStageProps) {
  const { page, pageBox, layout } = useLayoutResolution();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [previewZoom, setPreviewZoom] = useState(PREVIEW_ZOOM_FALLBACK);
  const imagePool = useEPPStore((state) => state.imagePool);
  const layoutMode = useEPPStore((state) => state.ui.layoutMode);
  const selectedSlotId = useEPPStore((state) => state.ui.selectedElementIds[0] ?? null);
  const setSelectedElementIds = useEPPStore((state) => state.setSelectedElementIds);
  const assignImageToSlot = useEPPStore((state) => state.assignImageToSlot);
  const clearImageFromSlot = useEPPStore((state) => state.clearImageFromSlot);
  const { createSlotDropProps } = useDragAndDrop();
  const pageWidthAtZoomOne = mmToPx(pageBox.w, 1);
  const pageHeightAtZoomOne = mmToPx(pageBox.h, 1);
  const previewWidthPx = mmToPx(pageBox.w, previewZoom);
  const previewHeightPx = mmToPx(pageBox.h, previewZoom);
  const imageSlots = collectImageSlotNodes(page.rootNode);
  const imageSlotMap = new Map(imageSlots.map((node) => [node.id, node]));
  const imageAssetMap = new Map(imagePool.map((asset) => [asset.id, asset]));

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const recomputeZoom = () => {
      const availableWidth = Math.max(1, element.clientWidth - PREVIEW_INNER_PADDING_PX);
      const availableHeight = Math.max(1, element.clientHeight - PREVIEW_INNER_PADDING_PX);
      const widthZoom = availableWidth / pageWidthAtZoomOne;
      const heightZoom = availableHeight / pageHeightAtZoomOne;
      setPreviewZoom(Math.max(0.05, Math.min(widthZoom, heightZoom)));
    };

    recomputeZoom();
    const observer = new ResizeObserver(() => {
      recomputeZoom();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageHeightAtZoomOne, pageWidthAtZoomOne]);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4 flex flex-none items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Page preview</h2>
          <p className="mt-1 text-xs text-slate-400">
            Click a slot to select it. Drag or click a library image, then assign it into the current layout.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
          {page.pageConfig.dpi} DPI
        </span>
      </div>

      <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950/80 p-6">
        <div className="flex min-h-full min-w-full items-center justify-center">
          <div
            className="relative bg-white shadow-2xl"
          style={{
            width: previewWidthPx,
            height: previewHeightPx,
          }}
        >
          {page.rootNode.paddingMm ? (
            <div
              className="pointer-events-none absolute border border-dashed border-slate-400/70"
              style={{
                left: mmToPx(page.rootNode.paddingMm.left ?? 0, previewZoom),
                top: mmToPx(page.rootNode.paddingMm.top ?? 0, previewZoom),
                width:
                  previewWidthPx -
                  mmToPx((page.rootNode.paddingMm.left ?? 0) + (page.rootNode.paddingMm.right ?? 0), previewZoom),
                height:
                  previewHeightPx -
                  mmToPx((page.rootNode.paddingMm.top ?? 0) + (page.rootNode.paddingMm.bottom ?? 0), previewZoom),
              }}
            />
          ) : null}

          {layoutMode === 'nested'
            ? Array.from(layout.entries())
                .filter(([id]) => id !== page.rootNode.id && !imageSlotMap.has(id))
                .map(([id, box]) => (
                  <div
                    key={`container-${id}`}
                    className={`pointer-events-none absolute border border-dashed ${
                      selectedSlotId === id ? 'border-cyan-500 ring-2 ring-cyan-500/35' : 'border-slate-500/70'
                    }`}
                    style={{
                      left: mmToPx(box.x, previewZoom),
                      top: mmToPx(box.y, previewZoom),
                      width: mmToPx(box.w, previewZoom),
                      height: mmToPx(box.h, previewZoom),
                    }}
                  >
                    <span className="absolute left-2 top-2 rounded-full bg-slate-950/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {id}
                    </span>
                  </div>
                ))
            : null}

          {Array.from(layout.entries())
            .filter(([id]) => imageSlotMap.has(id) && (id !== page.rootNode.id || page.rootNode.type === 'imageSlot'))
            .map(([id, box]) => (
              <div
                key={id}
                role="button"
                tabIndex={0}
                className={`group absolute overflow-hidden border text-left transition ${
                  selectedSlotId === id
                    ? 'border-cyan-500 ring-2 ring-cyan-500/35'
                    : 'border-slate-300 hover:border-slate-500'
                } ${page.assignments[id] ? 'bg-slate-100' : 'bg-slate-100/80'}`}
                style={{
                  left: mmToPx(box.x, previewZoom),
                  top: mmToPx(box.y, previewZoom),
                  width: mmToPx(box.w, previewZoom),
                  height: mmToPx(box.h, previewZoom),
                }}
                onClick={() => {
                  if (selectedSlotId === id) {
                    setSelectedElementIds([]);
                    return;
                  }

                  setSelectedElementIds([id]);
                  if (selectedImageAssetId) {
                    assignImageToSlot(page.id, id, selectedImageAssetId);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                  }

                  event.preventDefault();
                  if (selectedSlotId === id) {
                    setSelectedElementIds([]);
                    return;
                  }

                  setSelectedElementIds([id]);
                  if (selectedImageAssetId) {
                    assignImageToSlot(page.id, id, selectedImageAssetId);
                  }
                }}
                {...createSlotDropProps((imageAssetId) => {
                  setSelectedElementIds([id]);
                  assignImageToSlot(page.id, id, imageAssetId);
                })}
              >
                {page.assignments[id] && imageAssetMap.get(page.assignments[id]) ? (
                  <img
                    src={imageAssetMap.get(page.assignments[id])?.thumbnailDataUrl}
                    alt={imageAssetMap.get(page.assignments[id])?.fileName}
                    className="absolute inset-0 h-full w-full"
                    style={{
                      objectFit: scalingRuleToObjectFit(imageSlotMap.get(id)?.imageSlotConfig?.scalingRule),
                    }}
                  />
                ) : null}

                {page.assignments[id] ? (
                  <button
                    type="button"
                    aria-label={`Remove image from ${id}`}
                    className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-slate-950/80 text-sm font-semibold text-white opacity-0 shadow transition group-hover:opacity-100 hover:bg-rose-600"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      clearImageFromSlot(page.id, id);
                      if (selectedSlotId === id) {
                        setSelectedElementIds([]);
                      }
                    }}
                  >
                    ×
                  </button>
                ) : null}

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/0 to-slate-950/10" />

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2">
                  <span className="rounded-full bg-slate-950/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {id === page.rootNode.id ? 'root' : id}
                  </span>
                  <span className="rounded-full bg-white/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    {page.assignments[id] ? 'assigned' : 'drop image'}
                  </span>
                </div>

                {!page.assignments[id] ? (
                  <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] font-medium text-slate-500">
                    {selectedImageAssetId ? 'Click to assign selected image' : 'Drag an image here'}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
