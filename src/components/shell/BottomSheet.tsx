import type { ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Shared chrome for every mobile sheet (tab-bar destinations and the Properties auto-sheet) --
 * backdrop, grabber, a title slot for the active destination's label, and an explicit close control.
 * Slides open/closed on a CSS transition, not a drag gesture (see design.md Non-Goals). Stays mounted
 * while closed so the slide-down transition can play; `BottomTabBar` renders above this in z-index,
 * so it stays reachable while a sheet is open -- tapping the open destination again is a second way
 * to close it, alongside this backdrop tap and the close button. */
export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={title}
        aria-hidden={!open}
        className={`fixed inset-x-0 bottom-16 z-30 flex max-h-[65vh] flex-col rounded-t-2xl border-t border-slate-800 bg-slate-900 shadow-xl transition-transform duration-200 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex flex-none items-center justify-center pt-2">
          <div className="h-1 w-10 rounded-full bg-slate-700" />
        </div>
        <div className="flex flex-none items-center justify-between px-4 pb-2 pt-1">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            &#x2715;
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </>
  );
}
