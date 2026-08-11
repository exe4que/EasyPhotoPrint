export type MobileTabId = 'page' | 'layout' | 'photos' | 'templates';

interface BottomTabBarProps {
  activeTab: MobileTabId | null;
  onSelect: (tab: MobileTabId) => void;
}

const TABS: ReadonlyArray<{ id: MobileTabId; label: string }> = [
  { id: 'page', label: 'Page' },
  { id: 'layout', label: 'Layout' },
  { id: 'photos', label: 'Photos' },
  { id: 'templates', label: 'Templates' },
];

/** Persistent bottom navigation with the four mobile-shell destinations. Rendered above
 * `BottomSheet` in z-index so it stays tappable while a sheet is open -- `MobileShell` toggles the
 * open tab closed when the same destination is tapped again, per the `mobile-shell` capability's
 * "Bottom Tab Bar With Four Destinations" requirement. */
export function BottomTabBar({ activeTab, onSelect }: BottomTabBarProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-slate-800 bg-slate-900">
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-pressed={isActive}
            className={`flex flex-1 flex-col items-center justify-center text-xs font-medium transition-colors ${
              isActive ? 'text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
