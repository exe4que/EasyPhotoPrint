import { useEffect, useState, type KeyboardEvent } from 'react';

interface CommitIntegerInputProps {
  value: number;
  min: number;
  onCommit: (value: number) => void;
}

/** Numeric field for integer counts (grid rows/columns, slot count, DPI) that buffers raw text in
 * local state instead of binding straight to the committed value. A directly-bound `type="number"`
 * input can never actually be cleared: deleting its last character sends `Number('') === 0` to the
 * caller, which typically clamps back to `min` on the next render before the field is ever seen
 * empty. Committing only on blur/Enter (rather than every keystroke, as `CommitLengthInput` does)
 * also matters here specifically because some callers (grid rows/columns) reconcile child nodes on
 * every commit -- a per-keystroke commit would destroy already-placed content at an intermediate
 * value while typing a multi-digit number. */
export function CommitIntegerInput({ value, min, onCommit }: CommitIntegerInputProps) {
  const [draft, setDraft] = useState(() => String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    setDraft(String(value));
  }, [isEditing, value]);

  const commit = () => {
    const trimmed = draft.trim();
    const parsed = Number(trimmed);
    if (trimmed === '' || !Number.isInteger(parsed) || parsed < min) {
      setDraft(String(value));
      return;
    }
    onCommit(parsed);
    setDraft(String(parsed));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commit();
      event.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      min={min}
      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      value={draft}
      onFocus={() => setIsEditing(true)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setIsEditing(false);
        commit();
      }}
      onKeyDown={handleKeyDown}
    />
  );
}
