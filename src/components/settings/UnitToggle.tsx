import { useEPPStore } from '../../store/index.js';

const OPTIONS = [
  { value: 'metric', label: 'mm' },
  { value: 'imperial', label: 'in' },
] as const;

export function UnitToggle() {
  const unitSystem = useEPPStore((state) => state.settings.unitSystem);
  const setUnitSystem = useEPPStore((state) => state.setUnitSystem);

  return (
    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-sm">
      {OPTIONS.map((option) => {
        const active = option.value === unitSystem;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => void setUnitSystem(option.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

