// @spec OPENSPEC.md §4.1.1 — draggable divider between adjacent children of a horizontal/vertical node
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
  /** Called with the delta accumulated since the drag started (not per-frame). */
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
  const handleMouseDown = (event: React.MouseEvent) => {
    if (locked || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();

    const startClientPos = direction === 'horizontal' ? event.clientX : event.clientY;
    onDragStart();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentClientPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      onDragDeltaMm(pxToMm(currentClientPos - startClientPos, previewZoom));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      onDragEnd();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      role="separator"
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
      onMouseDown={handleMouseDown}
      title={locked ? 'Locked: an adjacent node has a fixed size on this axis' : undefined}
      className={`group absolute z-20 flex items-center justify-center ${
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
