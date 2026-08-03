import { useState, type KeyboardEvent, type ReactNode } from 'react';

interface CollapsiblePanelProps {
  title: string;
  description?: string;
  /** Rendered next to the description, inline in the header, instead of on its own row. */
  headerAction?: ReactNode;
  actions?: ReactNode;
  defaultCollapsed?: boolean;
  children: ReactNode;
}

export function CollapsiblePanel({
  title,
  description,
  headerAction,
  actions,
  defaultCollapsed = false,
  children,
}: CollapsiblePanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = () => setCollapsed((value) => !value);
  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    toggle();
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80">
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={handleHeaderKeyDown}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {!collapsed && (description || headerAction) ? (
            <div className="mt-1 flex items-center justify-between gap-3">
              {description ? <p className="text-xs text-slate-400">{description}</p> : <span />}
              {headerAction ? (
                <div onClick={(event) => event.stopPropagation()} className="flex-none">
                  {headerAction}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className={`text-xs text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
        >
          v
        </span>
      </div>

      {!collapsed ? (
        <div className="border-t border-slate-800 px-4 py-4">
          {actions ? <div className="mb-4 flex items-start justify-between gap-3">{actions}</div> : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

