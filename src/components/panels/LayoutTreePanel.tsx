// @spec OPENSPEC.md §4.1, §6.1 — editable layout tree for nested mode
import type { LayoutNode } from '@epp/layout-engine';

import { useEPPStore } from '../../store/index.js';
import { CollapsiblePanel } from '../ui/CollapsiblePanel.js';

type EditableNodeType = 'grid' | 'horizontal' | 'vertical' | 'imageSlot' | 'freeformCanvas';

function LayoutTreeNode({
  node,
  depth,
  selectedNodeId,
  activePageId,
}: {
  node: LayoutNode;
  depth: number;
  selectedNodeId: string | null;
  activePageId: string;
}) {
  const setSelectedElementIds = useEPPStore((state) => state.setSelectedElementIds);
  const retypeLayoutNode = useEPPStore((state) => state.retypeLayoutNode);
  const addNestedChildNode = useEPPStore((state) => state.addNestedChildNode);
  const removeLayoutNode = useEPPStore((state) => state.removeLayoutNode);
  const isSelected = selectedNodeId === node.id;
  const isContainer = node.type === 'horizontal' || node.type === 'vertical' || node.type === 'grid';

  return (
    <div className="space-y-2">
      <div
        className={`rounded-lg border p-3 ${
          isSelected ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/70'
        }`}
        style={{ marginLeft: depth * 14 }}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedElementIds(isSelected ? [] : [node.id])}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }
          event.preventDefault();
          setSelectedElementIds(isSelected ? [] : [node.id]);
        }}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-300">
              {node.id === 'root-grid' || node.id === 'root-node' || node.id === 'root' ? 'root' : node.id}
            </div>
            <div className="text-xs text-slate-500">{node.type}</div>
          </div>
          <select
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            value={node.type}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => retypeLayoutNode(activePageId, node.id, event.target.value as EditableNodeType)}
          >
            <option value="grid">grid</option>
            <option value="horizontal">horizontal</option>
            <option value="vertical">vertical</option>
            <option value="imageSlot">imageSlot</option>
            <option value="freeformCanvas">freeformCanvas</option>
          </select>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {node.type === 'horizontal' || node.type === 'vertical' ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                addNestedChildNode(activePageId, node.id, 'imageSlot');
              }}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-slate-600"
            >
              + Node
            </button>
          ) : null}
          {node.id !== 'root-grid' && node.id !== 'root-node' && node.id !== 'root' ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeLayoutNode(activePageId, node.id);
              }}
              className="rounded-md border border-rose-500/40 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
            >
              Remove
            </button>
          ) : null}
          {node.type === 'grid' ? (
            <span className="rounded-md border border-slate-800 px-2 py-1 text-[11px] text-slate-500">
              Use Grid properties to change rows/columns.
            </span>
          ) : null}
        </div>
      </div>

      {isContainer
        ? node.children?.map((child) => (
            <LayoutTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              activePageId={activePageId}
            />
          ))
        : null}
    </div>
  );
}

export function LayoutTreePanel() {
  const activePageId = useEPPStore((state) => state.ui.activePageId);
  const selectedNodeId = useEPPStore((state) => state.ui.selectedElementIds[0] ?? null);
  const activePage = useEPPStore(
    (state) => state.document.pages.find((page) => page.id === activePageId) ?? state.document.pages[0],
  );

  return (
    <CollapsiblePanel
      title="Layout tree"
      description="Edit the nested node hierarchy and switch between grid, horizontal, vertical, slot, and freeform-canvas nodes."
      defaultCollapsed={false}
    >
      <LayoutTreeNode node={activePage.rootNode} depth={0} selectedNodeId={selectedNodeId} activePageId={activePageId} />
    </CollapsiblePanel>
  );
}
