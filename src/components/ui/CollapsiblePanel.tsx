import { useState, type ReactNode } from 'react';

interface CollapsiblePanelProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  defaultCollapsed?: boolean;
  children: ReactNode;
}

export function CollapsiblePanel({
  title,
  description,
  actions,
  defaultCollapsed = false,
  children,
}: CollapsiblePanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {!collapsed && description ? <p className="mt-1 text-xs text-slate-400">{description}</p> : null}
        </div>
        <span
          aria-hidden="true"
          className={`text-xs text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
        >
          v
        </span>
      </button>

      {!collapsed ? (
        <div className="border-t border-slate-800 px-4 py-4">
          {actions ? <div className="mb-4 flex items-start justify-between gap-3">{actions}</div> : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

