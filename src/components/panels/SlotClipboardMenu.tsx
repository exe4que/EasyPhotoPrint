import { useEffect, useRef, useState } from 'react';

export interface SlotClipboardMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

/** The "⋮" button on an imageSlot's Properties panel section, exposing the `slot-clipboard`
 * actions (Copy, Copy to siblings, Copy to page, Paste). Mirrors `MenuBarMenu`'s open/close and
 * outside-click/Escape handling, but as an icon button rather than a bar-styled text label. */
export function SlotClipboardMenu({ items }: { items: SlotClipboardMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Slot actions"
        className={`flex h-7 w-7 items-center justify-center rounded-md text-base leading-none ${
          open ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
        }`}
      >
        ⋮
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Slot actions"
          className="absolute right-0 top-full z-40 mt-1 min-w-[190px] rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-2xl"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:text-slate-600 disabled:hover:bg-transparent"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
