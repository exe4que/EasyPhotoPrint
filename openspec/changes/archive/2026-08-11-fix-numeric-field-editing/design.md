## Context

`PropertiesPanel.tsx` already has two working examples of the draft-buffering pattern needed here (`CommitLengthInput`, `ClearableLengthInput`, `PropertiesPanel.tsx:14-149`): local `draft`/`isEditing` state decoupled from the committed store value, resynced from the store only when not editing. The four broken fields (Rows/Columns/Slots at `PropertiesPanel.tsx:445-473,521-529`, DPI at `PageSetupPanel.tsx:110-116`) skip that layer entirely and bind `value`/`onChange` straight to the store. See `proposal.md` - Why for the resulting bug.

Unlike the existing draft-pattern components, which commit on every keystroke (safe for them — an intermediate length value like "1" while typing "10" is harmless), Rows/Columns feed `reconcileGridChildren` (`documentSlice.ts:110-121`), which truncates children when the count drops. A per-keystroke commit would destroy placed images during an intermediate value while typing a multi-digit number.

## Goals / Non-Goals

**Goals:**
- One shared component covering all four fields, replacing direct store binding with draft/commit-on-blur-or-Enter.
- Each field keeps enforcing its own minimum (1 for Rows/Columns/Slots, 72 for DPI), now at commit time instead of via the decorative `min` HTML attribute.

**Non-Goals:**
- Changing `CommitLengthInput`/`ClearableLengthInput` — they don't have this bug and use a different (correct, for them) per-keystroke commit timing.
- Spin buttons or any custom increment/decrement control — explicitly deferred per the proposal.
- Changing the store actions (`updateGridNodeConfig`, `setContainerChildCount`, `updatePageConfig`) or their existing clamping — the new component just changes what gets sent and when.

## Decisions

- **New component `CommitIntegerInput`, in `src/components/ui/`.** All four fields are integer counts/DPI, so a single integer-typed component (parses with `Number.parseInt`, rejects non-integer input) covers them, rather than generalizing `CommitLengthInput` (which is float-oriented and unit-aware — a different concern). Placed in `src/components/ui/` alongside this codebase's other cross-panel primitives (`CollapsiblePanel`, `ConfirmDialog`), since it's used from both `PropertiesPanel.tsx` and `PageSetupPanel.tsx`.
- **Props: `value: number`, `min: number`, `onCommit: (value: number) => void`.** Mirrors the existing draft components' shape (`valueMm`/`onCommit` on `CommitLengthInput`) for consistency. No `label`/unit-suffix prop — callers already render their own `FieldLabel` around it, matching how the existing inputs are used today.
- **Commit on blur or Enter, not on every keystroke** — the key difference from `CommitLengthInput`. While editing, the field is uncontrolled free text (draft state only); nothing reaches the store until commit. This satisfies both the "can be cleared" requirement and avoids the destructive intermediate-value problem described in Context.
- **Invalid/below-minimum input on commit reverts the draft to the last valid value**, mirroring `ClearableLengthInput.commit()`'s existing revert-on-invalid behavior — it does not clamp up to the minimum and keep whatever was typed, and does not silently accept an invalid value into the store.
- **DPI (`PageSetupPanel.tsx`) uses the same component even though `PageSetupPanel` isn't covered by the `properties-panel` capability's new requirement.** Same bug, same fix, same shared component; the requirement text stays scoped to Properties panel's own three fields since that's the capability that owns them (see proposal.md - Impact).

Alternatives considered:
- **Generalize `CommitLengthInput` into one component covering both length and integer fields.** Rejected — the unit conversion (`toDisplayValue`/`fromDisplayValue`, imperial/metric) and per-keystroke commit timing are specific to length fields and don't apply here; forcing both into one component would need mode-switching props for behavior that's better left as two small, single-purpose components.
- **Keep per-keystroke commit but debounce it.** Rejected — a debounce still eventually commits an intermediate value if the user pauses mid-digit-entry (e.g., decides what to type next), so it doesn't actually eliminate the destructive-truncation risk, just makes it less likely.

## Risks / Trade-offs

- [Commit-on-blur means Rows/Columns/Slots no longer show a live layout preview while typing, unlike before] → Accepted: the "live" update was never reliable to begin with (it's what caused the destructive-truncation risk), and none of the other integer-style fields in this app commit live either — this brings these three in line with expected form-field behavior instead of removing an intentional feature.
