// @spec OPENSPEC.md §1.3, §2.3, §4.1, §4.1.1, §6.1 — page preview shell backed by the shared layout engine
import { isDividerLocked, type LayoutNode } from '@epp/layout-engine';
import { useEffect, useRef, useState } from 'react';

import { useDragAndDrop } from '../../hooks/useDragAndDrop.js';
import { computeImageDisplayRectMm, scalingRuleToObjectFit } from '../../lib/imageDisplay.js';
import { formatLength, mmToPx, pxToMm } from '../../lib/units.js';
import { useLayoutResolution } from '../../hooks/useLayoutResolution.js';
import { useEPPStore } from '../../store/index.js';
import { DimensionOverlay } from './DimensionOverlay.js';
import { FreeformElementView } from './FreeformElement.js';
import { NodeDivider } from './NodeDivider.js';

const PREVIEW_ZOOM_FALLBACK = 0.38;
const PREVIEW_INNER_PADDING_PX = 48;

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

function collectFlexContainerNodes(node: LayoutNode): LayoutNode[] {
  const nodes = node.type === 'horizontal' || node.type === 'vertical' ? [node] : [];
  for (const child of node.children ?? []) {
    nodes.push(...collectFlexContainerNodes(child));
  }
  return nodes;
}

interface PageStageProps {
  selectedImageAssetId: string | null;
}

export function PageStage({ selectedImageAssetId }: PageStageProps) {
  const { page, pageBox, layout } = useLayoutResolution();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const suppressNextClickRef = useRef(false);
  const [previewZoom, setPreviewZoom] = useState(PREVIEW_ZOOM_FALLBACK);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const [hoveredImageSlotId, setHoveredImageSlotId] = useState<string | null>(null);
  const imagePool = useEPPStore((state) => state.imagePool);
  const layoutMode = useEPPStore((state) => state.ui.layoutMode);
  const unitSystem = useEPPStore((state) => state.settings.unitSystem);
  const selectedSlotId = useEPPStore((state) => state.ui.selectedElementIds[0] ?? null);
  const setSelectedElementIds = useEPPStore((state) => state.setSelectedElementIds);
  const clearSelection = useEPPStore((state) => state.clearSelection);
  const assignImageToSlot = useEPPStore((state) => state.assignImageToSlot);
  const clearImageFromSlot = useEPPStore((state) => state.clearImageFromSlot);
  const addFreeformElement = useEPPStore((state) => state.addFreeformElement);
  const removeFreeformElement = useEPPStore((state) => state.removeFreeformElement);
  const updateFreeformElementTransform = useEPPStore((state) => state.updateFreeformElementTransform);
  const resizeSiblingsByDrag = useEPPStore((state) => state.resizeSiblingsByDrag);
  const pauseHistory = useEPPStore((state) => state.pauseHistory);
  const resumeHistory = useEPPStore((state) => state.resumeHistory);
  const { createSlotDropProps, createPositionalDropProps } = useDragAndDrop();
  const pageWidthAtZoomOne = mmToPx(pageBox.w, 1);
  const pageHeightAtZoomOne = mmToPx(pageBox.h, 1);
  const previewWidthPx = mmToPx(pageBox.w, previewZoom);
  const previewHeightPx = mmToPx(pageBox.h, previewZoom);
  const imageSlots = collectImageSlotNodes(page.rootNode);
  const imageSlotMap = new Map(imageSlots.map((node) => [node.id, node]));
  const freeformCanvasMap = new Map(collectFreeformCanvasNodes(page.rootNode).map((node) => [node.id, node]));
  const flexContainers = collectFlexContainerNodes(page.rootNode);
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
                .filter(([id]) => id !== page.rootNode.id && !imageSlotMap.has(id) && !freeformCanvasMap.has(id))
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
                  // A NodeDivider drag can end (mouseup) over a sibling slot rather than back
                  // on the divider itself — ignore the resulting trailing native "click" so a
                  // resize gesture never also reassigns/selects the slot under the cursor.
                  if (suppressNextClickRef.current) {
                    suppressNextClickRef.current = false;
                    return;
                  }

                  if (selectedSlotId === id) {
                    clearSelection();
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
                    clearSelection();
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
                onMouseEnter={() => setHoveredSlotId(id)}
                onMouseMove={(event) => {
                  const asset = imageAssetMap.get(page.assignments[id] ?? '');
                  if (!asset) {
                    setHoveredImageSlotId((current) => (current === id ? null : current));
                    return;
                  }

                  const rect = event.currentTarget.getBoundingClientRect();
                  const localX = event.clientX - rect.left;
                  const localY = event.clientY - rect.top;
                  const displayRect = computeImageDisplayRectMm(
                    asset,
                    box,
                    imageSlotMap.get(id)?.imageSlotConfig?.scalingRule,
                  );
                  const insideImage =
                    localX >= mmToPx(displayRect.offsetXMm, previewZoom) &&
                    localX <= mmToPx(displayRect.offsetXMm + displayRect.widthMm, previewZoom) &&
                    localY >= mmToPx(displayRect.offsetYMm, previewZoom) &&
                    localY <= mmToPx(displayRect.offsetYMm + displayRect.heightMm, previewZoom);

                  setHoveredImageSlotId((current) => {
                    if (insideImage) {
                      return id;
                    }
                    return current === id ? null : current;
                  });
                }}
                onMouseLeave={() => {
                  setHoveredSlotId((current) => (current === id ? null : current));
                  setHoveredImageSlotId((current) => (current === id ? null : current));
                }}
              >
                {page.assignments[id] && imageAssetMap.get(page.assignments[id]) ? (
                  <img
                    src={imageAssetMap.get(page.assignments[id])?.thumbnailDataUrl}
                    alt={imageAssetMap.get(page.assignments[id])?.fileName}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    style={{
                      objectFit: scalingRuleToObjectFit(imageSlotMap.get(id)?.imageSlotConfig?.scalingRule),
                    }}
                  />
                ) : null}

                {page.assignments[id] ? (
                  <button
                    type="button"
                    aria-label={`Remove image from ${id}`}
                    className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-slate-950/80 text-sm font-semibold text-white opacity-0 shadow transition group-hover:opacity-100 hover:bg-rose-600"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      clearImageFromSlot(page.id, id);
                      if (selectedSlotId === id) {
                        clearSelection();
                      }
                    }}
                  >
                    ×
                  </button>
                ) : null}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/0 to-slate-950/10" />

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2">
                  {hoveredImageSlotId === id ? (
                    <span />
                  ) : (
                    <span className="rounded-full bg-slate-950/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {id === page.rootNode.id ? 'root' : id}
                    </span>
                  )}
                  <span className="rounded-full bg-white/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    {page.assignments[id] ? 'assigned' : 'drop image'}
                  </span>
                </div>

                <DimensionOverlay
                  showSlotLabel={hoveredSlotId === id}
                  slotLabel={`${formatLength(box.w, unitSystem)} × ${formatLength(box.h, unitSystem)}`}
                  showImageLabel={hoveredImageSlotId === id}
                  imageLabel={(() => {
                    const asset = imageAssetMap.get(page.assignments[id] ?? '');
                    if (!asset) {
                      return undefined;
                    }
                    const { widthMm, heightMm } = computeImageDisplayRectMm(
                      asset,
                      box,
                      imageSlotMap.get(id)?.imageSlotConfig?.scalingRule,
                    );
                    return `${formatLength(widthMm, unitSystem)} × ${formatLength(heightMm, unitSystem)}`;
                  })()}
                />

                {!page.assignments[id] ? (
                  <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] font-medium text-slate-500">
                    {selectedImageAssetId ? 'Click to assign selected image' : 'Drag an image here'}
                  </div>
                ) : null}
              </div>
            ))}

          {Array.from(layout.entries())
            .filter(([id]) => freeformCanvasMap.has(id))
            .map(([id, box]) => {
              const freeformCanvasNode = freeformCanvasMap.get(id);
              if (!freeformCanvasNode) {
                return null;
              }

              const padding = freeformCanvasNode.paddingMm ?? {};
              const paddingTopPx = mmToPx(padding.top ?? 0, previewZoom);
              const paddingRightPx = mmToPx(padding.right ?? 0, previewZoom);
              const paddingBottomPx = mmToPx(padding.bottom ?? 0, previewZoom);
              const paddingLeftPx = mmToPx(padding.left ?? 0, previewZoom);

              return (
                <div
                  key={`freeform-${id}`}
                  className="absolute"
                  style={{
                    left: mmToPx(box.x, previewZoom),
                    top: mmToPx(box.y, previewZoom),
                    width: mmToPx(box.w, previewZoom),
                    height: mmToPx(box.h, previewZoom),
                  }}
                  onClick={() => {
                    // A move/resize/rotate drag on a FreeformElementView can end (mouseup) past
                    // its own small bounding box, over this background — the trailing native
                    // "click" then bubbles up here. Ignore it so a drag never also selects the
                    // canvas out from under an element the user was just transforming.
                    if (suppressNextClickRef.current) {
                      suppressNextClickRef.current = false;
                      return;
                    }

                    setSelectedElementIds([id]);
                  }}
                  {...createPositionalDropProps((imageAssetId, event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    addFreeformElement(page.id, id, imageAssetId, {
                      xMm: pxToMm(event.clientX - rect.left, previewZoom),
                      yMm: pxToMm(event.clientY - rect.top, previewZoom),
                    });
                  })}
                >
                  <div
                    className="pointer-events-none absolute border border-dashed border-slate-400/70"
                    style={{
                      left: paddingLeftPx,
                      top: paddingTopPx,
                      width: mmToPx(box.w, previewZoom) - paddingLeftPx - paddingRightPx,
                      height: mmToPx(box.h, previewZoom) - paddingTopPx - paddingBottomPx,
                    }}
                  />

                  <div
                    className="absolute overflow-hidden"
                    style={{ left: paddingLeftPx, top: paddingTopPx, right: paddingRightPx, bottom: paddingBottomPx }}
                  >
                    {(freeformCanvasNode.freeformElements ?? []).map((element) => (
                      <FreeformElementView
                        key={element.id}
                        element={element}
                        offsetXMm={-(padding.left ?? 0)}
                        offsetYMm={-(padding.top ?? 0)}
                        asset={imageAssetMap.get(page.assignments[element.imageNodeId] ?? '')}
                        scalingRule={imageSlotMap.get(element.imageNodeId)?.imageSlotConfig?.scalingRule}
                        isSelected={selectedSlotId === element.imageNodeId}
                        previewZoom={previewZoom}
                        unitSystem={unitSystem}
                        onSelect={() => setSelectedElementIds([element.imageNodeId])}
                        onRemove={() => removeFreeformElement(page.id, id, element.id)}
                        onTransform={(patch) => updateFreeformElementTransform(page.id, id, element.id, patch)}
                        onDragStart={() => {
                          suppressNextClickRef.current = true;
                          pauseHistory();
                        }}
                        onDragEnd={() => {
                          resumeHistory();
                          setTimeout(() => {
                            suppressNextClickRef.current = false;
                          }, 0);
                        }}
                      />
                    ))}
                  </div>

                  {(freeformCanvasNode.freeformElements ?? []).length === 0 ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium text-slate-500">
                      Drag an image here from the library
                    </div>
                  ) : null}
                </div>
              );
            })}

          {flexContainers.flatMap((containerNode) => {
            const children = containerNode.children ?? [];
            const mainAxisKey = containerNode.type === 'horizontal' ? 'widthMm' : 'heightMm';
            const containerBox = layout.get(containerNode.id);
            if (!containerBox || children.length < 2) {
              return [];
            }

            return children.slice(0, -1).map((_, siblingIndexA) => {
              const boxA = layout.get(children[siblingIndexA].id);
              const boxB = layout.get(children[siblingIndexA + 1].id);
              if (!boxA || !boxB) {
                return null;
              }

              const locked = isDividerLocked(children, siblingIndexA, mainAxisKey);
              const centerMm =
                containerNode.type === 'horizontal'
                  ? (boxA.x + boxA.w + boxB.x) / 2
                  : (boxA.y + boxA.h + boxB.y) / 2;

              return (
                <NodeDivider
                  key={`divider-${containerNode.id}-${siblingIndexA}`}
                  direction={containerNode.type as 'horizontal' | 'vertical'}
                  locked={locked}
                  centerPx={mmToPx(centerMm, previewZoom)}
                  crossStartPx={
                    containerNode.type === 'horizontal' ? mmToPx(containerBox.y, previewZoom) : mmToPx(containerBox.x, previewZoom)
                  }
                  crossLengthPx={
                    containerNode.type === 'horizontal' ? mmToPx(containerBox.h, previewZoom) : mmToPx(containerBox.w, previewZoom)
                  }
                  previewZoom={previewZoom}
                  onDragStart={() => {
                    suppressNextClickRef.current = true;
                    pauseHistory();
                  }}
                  onDragDeltaMm={(deltaMm) => resizeSiblingsByDrag(page.id, containerNode.id, siblingIndexA, deltaMm)}
                  onDragEnd={() => {
                    resumeHistory();
                    setTimeout(() => {
                      suppressNextClickRef.current = false;
                    }, 0);
                  }}
                />
              );
            });
          })}
          </div>
        </div>
      </div>
    </section>
  );
}
