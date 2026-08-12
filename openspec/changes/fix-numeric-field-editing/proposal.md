## Why

On mobile, the Rows/Columns/Slots numeric fields in the Properties panel (and the DPI field in Page Setup) cannot be cleared and retyped: they're bound directly to store state with no local draft, so clearing the field to `''` sends `Number('') === 0` straight to the store, which clamps it back to its minimum on the next render before the user ever sees an empty field. Desktop users rarely hit this because the browser's native spin buttons let them change the value without typing into an empty field — but those spin buttons don't render on Android WebView/mobile Chrome at all, so mobile users are forced through the broken text-editing path on every edit. The two length-style fields in the same file (padding, gap) don't have this problem because they already buffer raw text in local state before committing.

## What Changes

- Add a shared, reusable numeric-input component (in `src/components/ui/`, alongside this codebase's other reusable field/UI primitives) that buffers the user's raw text in local state so the field can be freely cleared and retyped, and commits a clamped, valid value to the store only on blur or Enter — not on every keystroke.
- Commit-on-blur/Enter (rather than the existing per-keystroke pattern used by the padding/gap fields) is required specifically for Rows/Columns: `reconcileGridChildren` truncates child nodes when the count drops, so a per-keystroke commit would destroy already-placed images in an intermediate state while typing a multi-digit number (e.g. typing "13" over "3" would transiently commit `rows=1`).
- Apply the new component to the four numeric fields currently bound directly to the store: Rows, Columns, and Slots in `PropertiesPanel.tsx`, and DPI in `PageSetupPanel.tsx`. Each field's own minimum (1 for Rows/Columns/Slots, 72 for DPI) is enforced at commit time by the component itself, instead of relying on the `min` HTML attribute, which today is purely decorative and doesn't prevent an invalid value from reaching the store.
- No change to the two already-correct length-style inputs (`CommitLengthInput`, `ClearableLengthInput`) — they don't have this bug.
- Out of scope (explicitly deferred, not part of this change): restoring or emulating spin-button controls. Native spin buttons aren't reliably renderable on Android WebView regardless of CSS, and adding custom tap +/- controls is a separate enhancement the user chose not to bundle here.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `properties-panel`: adds a requirement that the panel's numeric fields (Rows, Columns, Slots) support being fully cleared and retyped without snapping back to their previous value while being edited, and that an invalid or out-of-range value reverts to the last valid value on blur/Enter rather than being silently clamped mid-edit.

## Impact

- `src/components/ui/` — new shared component (e.g. `CommitIntegerInput.tsx`) implementing the draft/commit-on-blur pattern.
- `src/components/panels/PropertiesPanel.tsx` — Rows, Columns, Slots inputs switch to the new component.
- `src/components/panels/PageSetupPanel.tsx` — DPI input switches to the new component. `PageSetupPanel` isn't governed by any existing capability spec, so this part of the fix is applied for consistency (same bug, same shared component) without a corresponding spec delta.
- No store/schema changes — `updateGridNodeConfig`, `setContainerChildCount`, and `updatePageConfig` keep their existing signatures and clamping behavior; the fix is entirely in what the input commits to them and when.
