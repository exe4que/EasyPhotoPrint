import { useRef } from 'react';

import { pxToMm } from '../../lib/units.js';

const HIT_SIZE_PX = 14;

interface NodeDividerProps {
  direction: 'horizontal' | 'vertical';
  locked: boolean;
  /** Center of the divider along the main axis (px, relative to the page container). */
  centerPx: number;
  /** Start of the divider along the cross axis (px, relative to the page container). */
  crossStartPx: number;
  /** Length of the divider along the cross axis, in px. */
  crossLengthPx: number;
  previewZoom: number;
  onDragStart: () => void;
  /**
   * Called with the delta since the *previous* call (not since the drag started) — the store
   * action re-derives each sibling's current size from the live tree on every call, so handing
   * it an already-cumulative delta on top of that would double-count and make the divider
   * drift away from the cursor, compounding with every pointermove event fired during the drag.
   */
  onDragDeltaMm: (deltaMm: number) => void;
  onDragEnd: () => void;
}

export function NodeDivider({
  direction,
  locked,
  centerPx,
  crossStartPx,
  crossLengthPx,
  previewZoom,
  onDragStart,
  onDragDeltaMm,
  onDragEnd,
}: NodeDividerProps) {
  // A ref, not state: this drives synchronous per-event math, not a render. Tracking the
  // pointerId (rather than a boolean) means a second finger touching the divider mid-drag is
  // ignored instead of corrupting the active drag -- multi-touch on a single divider was never a
  // supported interaction.
  const activePointerId = useRef<number | null>(null);
  const lastClientPosRef = useRef(0);

  const handlePointerDown = (event: React.PointerEvent) => {
    if (locked || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();

    // Pointer capture routes every subsequent event for this pointerId to this element
    // regardless of where the pointer physically moves -- no window listeners needed, and the
    // drag can't "escape" the divider's small hit area the way a plain element-level mouse
    // listener could.
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerId.current = event.pointerId;
    lastClientPosRef.current = direction === 'horizontal' ? event.clientX : event.clientY;
    onDragStart();
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (event.pointerId !== activePointerId.current) {
      return;
    }

    const currentClientPos = direction === 'horizontal' ? event.clientX : event.clientY;
    const deltaPx = currentClientPos - lastClientPosRef.current;
    lastClientPosRef.current = currentClientPos;
    onDragDeltaMm(pxToMm(deltaPx, previewZoom));
  };

  const handlePointerEnd = (event: React.PointerEvent) => {
    if (event.pointerId !== activePointerId.current) {
      return;
    }
    activePointerId.current = null;
    onDragEnd();
  };

  return (
    <div
      role="separator"
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      title={locked ? 'Locked: an adjacent node has a fixed size on this axis' : undefined}
      className={`group absolute z-20 flex touch-none items-center justify-center ${
        locked ? 'cursor-not-allowed' : direction === 'horizontal' ? 'cursor-col-resize' : 'cursor-row-resize'
      }`}
      style={
        direction === 'horizontal'
          ? { left: centerPx - HIT_SIZE_PX / 2, top: crossStartPx, width: HIT_SIZE_PX, height: crossLengthPx }
          : { top: centerPx - HIT_SIZE_PX / 2, left: crossStartPx, height: HIT_SIZE_PX, width: crossLengthPx }
      }
    >
      <div
        className={`rounded-full transition ${locked ? 'bg-slate-600/60' : 'bg-white/0 group-hover:bg-cyan-400/80'} ${
          direction === 'horizontal' ? 'h-full w-0.5' : 'h-0.5 w-full'
        }`}
      />
      {locked ? (
        <span className="pointer-events-none absolute rounded-full bg-slate-950/90 px-1.5 py-0.5 text-[9px] leading-none text-slate-300 opacity-0 group-hover:opacity-100">
          🔒
        </span>
      ) : null}
    </div>
  );
}
