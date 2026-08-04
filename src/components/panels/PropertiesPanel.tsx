import { computeStretch, type LayoutNode, type Sides } from '@epp/layout-engine';
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';

import { useLayoutResolution } from '../../hooks/useLayoutResolution.js';
import { isSpecificSizeUnsatisfied } from '../../lib/imageDisplay.js';
import { formatLength, inchesToMm, mmToInches } from '../../lib/units.js';
import { useEPPStore } from '../../store/index.js';
import { CollapsiblePanel } from '../ui/CollapsiblePanel.js';

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{children}</label>;
}

function CommitLengthInput({
  valueMm,
  unitSystem,
  onCommit,
}: {
  valueMm: number;
  unitSystem: 'metric' | 'imperial';
  onCommit: (valueMm: number) => void;
}) {
  const unitLabel = unitSystem === 'imperial' ? 'in' : 'mm';
  const step = 0.1;
  const toDisplayValue = (mm: number): string =>
    unitSystem === 'imperial' ? mmToInches(mm).toFixed(2) : mm.toFixed(1);
  const fromDisplayValue = (value: number): number => (unitSystem === 'imperial' ? inchesToMm(value) : value);
  const [draft, setDraft] = useState(() => toDisplayValue(valueMm));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    setDraft(toDisplayValue(valueMm));
  }, [isEditing, valueMm, unitSystem]);

  const commitDisplayValue = (displayValue: number) => {
    const nextMm = Math.max(0, fromDisplayValue(displayValue));
    onCommit(nextMm);
    setDraft(toDisplayValue(nextMm));
  };

  const commit = () => {
    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(toDisplayValue(valueMm));
      return;
    }

    commitDisplayValue(parsed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commit();
      event.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        step={step}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        value={draft}
        onFocus={() => setIsEditing(true)}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = Number.parseFloat(event.target.value);
          if (Number.isFinite(parsed)) {
            onCommit(Math.max(0, fromDisplayValue(parsed)));
          }
        }}
        onBlur={() => {
          setIsEditing(false);
          commit();
        }}
        onKeyDown={handleKeyDown}
      />
      <span className="min-w-8 text-xs font-medium uppercase tracking-wide text-slate-400">{unitLabel}</span>
    </div>
  );
}

function ClearableLengthInput({
  valueMm,
  unitSystem,
  onCommit,
}: {
  valueMm: number | undefined;
  unitSystem: 'metric' | 'imperial';
  onCommit: (valueMm: number | null) => void;
}) {
  const unitLabel = unitSystem === 'imperial' ? 'in' : 'mm';
  const toDisplayValue = (mm: number | undefined): string =>
    mm == null ? '' : unitSystem === 'imperial' ? mmToInches(mm).toFixed(2) : mm.toFixed(1);
  const fromDisplayValue = (value: number): number => (unitSystem === 'imperial' ? inchesToMm(value) : value);
  const [draft, setDraft] = useState(() => toDisplayValue(valueMm));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    setDraft(toDisplayValue(valueMm));
  }, [isEditing, valueMm, unitSystem]);

  const commit = () => {
    if (draft.trim() === '') {
      onCommit(null);
      return;
    }
    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDraft(toDisplayValue(valueMm));
      return;
    }
    onCommit(fromDisplayValue(parsed));
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        step={0.1}
        placeholder="auto"
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        value={draft}
        onFocus={() => setIsEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setIsEditing(false);
          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
            event.currentTarget.blur();
          }
        }}
      />
      <span className="min-w-8 text-xs font-medium uppercase tracking-wide text-slate-400">{unitLabel}</span>
    </div>
  );
}

const ASPECT_RATIO_TOLERANCE_MM = 0.05;

/** True when both axes of a `specificSizeMm` are explicitly locked (stretch) and no longer match the asset's original aspect ratio. */
function isAspectRatioBroken(specificSizeMm: { widthMm: number; heightMm: number; lockedAxis: string } | undefined, aspectRatio: number): boolean {
  if (!specificSizeMm || specificSizeMm.lockedAxis !== 'both') {
    return false;
  }
  const expectedHeightMm = specificSizeMm.widthMm / aspectRatio;
  return Math.abs(expectedHeightMm - specificSizeMm.heightMm) > ASPECT_RATIO_TOLERANCE_MM;
}

function findNodeById(node: LayoutNode, nodeId: string): LayoutNode | null {
  if (node.id === nodeId) {
    return node;
  }

  for (const child of node.children ?? []) {
    const match = findNodeById(child, nodeId);
    if (match) {
      return match;
    }
  }

  return null;
}

function renderPaddingInputs({
  padding,
  unitSystem,
  onCommit,
}: {
  padding: Partial<Sides>;
  unitSystem: 'metric' | 'imperial';
  onCommit: (side: 'top' | 'right' | 'bottom' | 'left', valueMm: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel>Padding top</FieldLabel>
        <CommitLengthInput valueMm={padding.top ?? 0} unitSystem={unitSystem} onCommit={(valueMm) => onCommit('top', valueMm)} />
      </div>
      <div>
        <FieldLabel>Padding right</FieldLabel>
        <CommitLengthInput valueMm={padding.right ?? 0} unitSystem={unitSystem} onCommit={(valueMm) => onCommit('right', valueMm)} />
      </div>
      <div>
        <FieldLabel>Padding bottom</FieldLabel>
        <CommitLengthInput valueMm={padding.bottom ?? 0} unitSystem={unitSystem} onCommit={(valueMm) => onCommit('bottom', valueMm)} />
      </div>
      <div>
        <FieldLabel>Padding left</FieldLabel>
        <CommitLengthInput valueMm={padding.left ?? 0} unitSystem={unitSystem} onCommit={(valueMm) => onCommit('left', valueMm)} />
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const layoutMode = useEPPStore((state) => state.ui.layoutMode);
  const selectedSlotId = useEPPStore((state) => state.ui.selectedElementIds[0] ?? null);
  const unitSystem = useEPPStore((state) => state.settings.unitSystem);
  const activePage = useEPPStore(
    (state) => state.document.pages.find((page) => page.id === activePageId) ?? state.document.pages[0],
  );
  const updateGridNodeConfig = useEPPStore((state) => state.updateGridNodeConfig);
  const updateLayoutNode = useEPPStore((state) => state.updateLayoutNode);
  const setSlotSpecificSize = useEPPStore((state) => state.setSlotSpecificSize);
  const setSimpleRootType = useEPPStore((state) => state.setSimpleRootType);
  const setContainerChildCount = useEPPStore((state) => state.setContainerChildCount);
  const imagePool = useEPPStore((state) => state.imagePool);
  const { layout } = useLayoutResolution();

  const selectedNode = selectedSlotId ? findNodeById(activePage.rootNode, selectedSlotId) : null;
  const contextNode =
    selectedNode ?? (layoutMode === 'simple' ? activePage.rootNode : activePage.rootNode.type === 'grid' ? activePage.rootNode : null);
  const slotPropertyNode =
    contextNode?.type === 'imageSlot'
      ? contextNode
      : null;
  const slotPropertyNodeId = slotPropertyNode?.id ?? null;
  const selectedAsset = slotPropertyNodeId
    ? imagePool.find((asset) => asset.id === activePage.assignments[slotPropertyNodeId]) ?? null
    : null;
  const selectedBox = slotPropertyNodeId ? layout.get(slotPropertyNodeId) : undefined;

  const rootTypeSelector =
    layoutMode === 'simple' && contextNode?.id === activePage.rootNode.id ? (
      <div>
        <FieldLabel>Root type</FieldLabel>
        <select
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          value={activePage.rootNode.type}
          onChange={(event) =>
            setSimpleRootType(
              activePage.id,
              event.target.value as 'grid' | 'horizontal' | 'vertical' | 'imageSlot' | 'freeformCanvas',
            )
          }
        >
          <option value="imageSlot">imageSlot</option>
          <option value="grid">grid</option>
          <option value="horizontal">horizontal</option>
          <option value="vertical">vertical</option>
          <option value="freeformCanvas">freeformCanvas</option>
        </select>
      </div>
    ) : null;

  if (slotPropertyNode) {
    const scalingRule = slotPropertyNode.imageSlotConfig?.scalingRule ?? 'fitInParent';
    const stretchWarning =
      scalingRule === 'stretch' && selectedAsset && selectedBox
        ? computeStretch(selectedAsset, selectedBox).distortionWarning
        : false;
    const specificSizeMm = slotPropertyNode.imageSlotConfig?.specificSizeMm;
    const specificSizeUnsatisfied =
      scalingRule === 'specificSize' && selectedBox ? isSpecificSizeUnsatisfied(specificSizeMm, selectedBox) : false;
    const assetAspectRatio = selectedAsset && selectedAsset.heightPx > 0 ? selectedAsset.widthPx / selectedAsset.heightPx : undefined;
    const aspectRatioBroken = assetAspectRatio != null && isAspectRatioBroken(specificSizeMm, assetAspectRatio);

    return (
      <CollapsiblePanel
        title="Slot properties"
        description="Configure how the selected image slot displays its assigned photo."
        defaultCollapsed={false}
      >
        <div className="grid gap-4">
          {rootTypeSelector}
          <div>
            <FieldLabel>Scaling rule</FieldLabel>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={scalingRule}
              onChange={(event) =>
                updateLayoutNode(activePage.id, slotPropertyNode.id, {
                  imageSlotConfig: {
                    scalingRule: event.target.value as 'fitInParent' | 'envelopeParent' | 'stretch' | 'specificSize',
                  },
                })
              }
            >
              <option value="fitInParent">fitInParent</option>
              <option value="envelopeParent">envelopeParent</option>
              <option value="stretch">stretch</option>
              <option value="specificSize">specificSize</option>
            </select>
          </div>

          {scalingRule === 'specificSize' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Width</FieldLabel>
                <ClearableLengthInput
                  valueMm={specificSizeMm?.widthMm}
                  unitSystem={unitSystem}
                  onCommit={(valueMm) => setSlotSpecificSize(activePage.id, slotPropertyNode.id, 'width', valueMm)}
                />
                {aspectRatioBroken ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSlotSpecificSize(
                        activePage.id,
                        slotPropertyNode.id,
                        'width',
                        specificSizeMm!.heightMm * assetAspectRatio!,
                      )
                    }
                    className="mt-1 text-left text-[11px] font-medium text-amber-400 hover:text-amber-300"
                  >
                    Adjust to restore aspect ratio
                  </button>
                ) : null}
              </div>
              <div>
                <FieldLabel>Height</FieldLabel>
                <ClearableLengthInput
                  valueMm={specificSizeMm?.heightMm}
                  unitSystem={unitSystem}
                  onCommit={(valueMm) => setSlotSpecificSize(activePage.id, slotPropertyNode.id, 'height', valueMm)}
                />
                {aspectRatioBroken ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSlotSpecificSize(
                        activePage.id,
                        slotPropertyNode.id,
                        'height',
                        specificSizeMm!.widthMm / assetAspectRatio!,
                      )
                    }
                    className="mt-1 text-left text-[11px] font-medium text-amber-400 hover:text-amber-300"
                  >
                    Adjust to restore aspect ratio
                  </button>
                ) : null}
              </div>
              <p className="col-span-2 text-xs text-slate-500">
                Set only one side to derive the other from the image's aspect ratio, or both to stretch the image to that exact size.
              </p>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
            <div className="text-xs uppercase tracking-wide text-slate-500">Assigned image</div>
            <div className="mt-1 font-medium text-white">{selectedAsset?.fileName ?? 'No image assigned'}</div>
            <div className="mt-1 text-xs text-slate-400">
              {selectedAsset && selectedBox
                ? `${selectedAsset.widthPx}×${selectedAsset.heightPx} -> ${formatLength(selectedBox.w, unitSystem)} × ${formatLength(selectedBox.h, unitSystem)}`
                : 'Assign an image to see preview-specific metadata here.'}
            </div>
          </div>

          {stretchWarning ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              This image will be visibly distorted in <code>stretch</code> mode because its aspect ratio differs from the slot by more than 15%.
            </div>
          ) : null}

          {specificSizeUnsatisfied ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              The requested specific size doesn&apos;t fit in the space this template gives the slot — the image is shown with a red
              outline in the preview.
            </div>
          ) : null}
        </div>
      </CollapsiblePanel>
    );
  }

  if (!contextNode) {
    return (
      <CollapsiblePanel
        title="Slot properties"
        description="Configure the selected slot or layout node."
        defaultCollapsed={false}
      >
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 px-4 py-5 text-sm text-slate-400">
          Select an <code>imageSlot</code> from the preview or the layout tree. In nested mode, selecting a container node will show its layout controls here too.
        </div>
      </CollapsiblePanel>
    );
  }

  if (contextNode.type === 'grid') {
    const gridConfig = contextNode.gridConfig ?? { rows: 1, columns: 1 };
    const padding = contextNode.paddingMm ?? {};
    return (
      <CollapsiblePanel
        title="Grid properties"
        description="Edit the selected grid structure, gap, and printable-area padding."
        defaultCollapsed={false}
      >
        <div className="grid gap-4">
          {rootTypeSelector}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Rows</FieldLabel>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={gridConfig.rows}
                onChange={(event) =>
                  updateGridNodeConfig(activePage.id, contextNode.id, {
                    gridConfig: {
                      rows: Number(event.target.value),
                    },
                  })
                }
              />
            </div>
            <div>
              <FieldLabel>Columns</FieldLabel>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={gridConfig.columns}
                onChange={(event) =>
                  updateGridNodeConfig(activePage.id, contextNode.id, {
                    gridConfig: {
                      columns: Number(event.target.value),
                    },
                  })
                }
              />
            </div>
          </div>

          <div>
            <FieldLabel>Gap</FieldLabel>
            <CommitLengthInput
              valueMm={contextNode.gapMm ?? 0}
              unitSystem={unitSystem}
              onCommit={(valueMm) =>
                updateGridNodeConfig(activePage.id, contextNode.id, {
                  gapMm: valueMm,
                })
              }
            />
          </div>

          {renderPaddingInputs({
            padding,
            unitSystem,
            onCommit: (side, valueMm) =>
              updateGridNodeConfig(activePage.id, contextNode.id, {
                paddingMm: { [side]: valueMm },
              }),
          })}
        </div>
      </CollapsiblePanel>
    );
  }

  return (
    <CollapsiblePanel
      title="Container properties"
      description="Edit the selected nested container spacing and padding."
      defaultCollapsed={false}
    >
      <div className="grid gap-4">
      {rootTypeSelector}
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
          <div className="text-xs uppercase tracking-wide text-slate-500">Selected node</div>
          <div className="mt-1 font-medium text-white">{contextNode.id}</div>
          <div className="mt-1 text-xs text-slate-400">{contextNode.type}</div>
        </div>

        {contextNode.type === 'horizontal' || contextNode.type === 'vertical' ? (
          <div>
            <FieldLabel>Slots</FieldLabel>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={contextNode.children?.length ?? 0}
              onChange={(event) =>
                setContainerChildCount(activePage.id, contextNode.id, Number(event.target.value))
              }
            />
          </div>
        ) : null}

        {contextNode.type !== 'freeformCanvas' ? (
          <div>
            <FieldLabel>Gap</FieldLabel>
            <CommitLengthInput
              valueMm={contextNode.gapMm ?? 0}
              unitSystem={unitSystem}
              onCommit={(valueMm) =>
                updateLayoutNode(activePage.id, contextNode.id, {
                  gapMm: valueMm,
                })
              }
            />
          </div>
        ) : null}

        {renderPaddingInputs({
          padding: contextNode.paddingMm ?? {},
          unitSystem,
          onCommit: (side, valueMm) =>
            updateLayoutNode(activePage.id, contextNode.id, {
              paddingMm: { [side]: valueMm },
            }),
        })}
      </div>
    </CollapsiblePanel>
  );
}
