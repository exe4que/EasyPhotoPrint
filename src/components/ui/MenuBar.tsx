import { useEffect, useRef, useState } from 'react';

export interface MenuBarItem {
  label: string;
  onClick: () => void;
}

export interface MenuBarMenuProps {
  label: string;
  items: MenuBarItem[];
}

/** One "File"/"Edit"-style dropdown: a text label that reveals a floating list of items on click,
 * mimicking a native application menu's look without being one -- there is no OS menu bar behind
 * it, just this component, the same on every host. Closes on an outside click, Escape, or picking
 * an item. */
function MenuBarMenu({ label, items }: MenuBarMenuProps) {
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
        className={`rounded-md px-2.5 py-1 text-sm font-medium ${
          open ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
        }`}
      >
        {label}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="absolute left-0 top-full z-40 mt-1 min-w-[190px] rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-2xl"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A row of `MenuBarMenu`s -- the shared, host-uniform stand-in for a native application menu. See
 * the `electron-shell` capability's "No Custom Application Menu" requirement for why there's no
 * real OS menu behind this on any host, and the `undo-redo`/`editor-layout` capabilities for why
 * these particular actions live here instead of a sidebar panel. */
export function MenuBar({ menus }: { menus: MenuBarMenuProps[] }) {
  return (
    <div className="flex items-center gap-1">
      {menus.map((menu) => (
        <MenuBarMenu key={menu.label} label={menu.label} items={menu.items} />
      ))}
    </div>
  );
}
