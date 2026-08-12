## 1. Shared component

- [x] 1.1 Create `src/components/ui/CommitIntegerInput.tsx`: `value`/`min`/`onCommit` props, local `draft`/`isEditing` state resynced from `value` only while not editing (same pattern as `CommitLengthInput`), `type="number"`.
- [x] 1.2 Commit only on blur or Enter (Enter also blurs, matching the existing components' `handleKeyDown`): parse `draft` as an integer, and if it's empty, non-integer, or below `min`, revert `draft` to the current `value` instead of committing.
- [x] 1.3 On a valid commit, call `onCommit` with the parsed integer and resync `draft` to it.

## 2. Wire up the four call sites

- [x] 2.1 `PropertiesPanel.tsx` Rows field (`:445-457`): replace the raw `<input type="number">` with `CommitIntegerInput`, `min={1}`, `onCommit` calling `updateGridNodeConfig(activePage.id, contextNode.id, { gridConfig: { rows: value } })`.
- [x] 2.2 `PropertiesPanel.tsx` Columns field (`:459-474`): same, wired to `gridConfig: { columns: value }`.
- [x] 2.3 `PropertiesPanel.tsx` Slots field (`:520-530`): same, `min={1}`, wired to `setContainerChildCount(activePage.id, contextNode.id, value)`.
- [x] 2.4 `PageSetupPanel.tsx` DPI field (`:108-117`): same, `min={72}`, wired to `updatePageConfig(page.id, { dpi: value })`.

## 3. Verification

- [x] 3.1 `npm run typecheck` and `npm run test` pass.
- [x] 3.2 Verify via the real-Electron-under-Xvfb harness: for each of the four fields, select an existing value, clear it fully (confirm the field goes empty and stays empty, no snap-back), type a new value, and confirm it commits on blur/Tab and on Enter. Verified for DPI, Rows, Columns, and Slots.
- [x] 3.3 Verify the destructive-truncation scenario is gone: with a grid node that has more than one row/column, change Rows from a higher number to a lower number by clearing and retyping a multi-digit value (clear "3", type "13" one keystroke at a time without blurring). Verified via slot count on the canvas (`[data-drop-target^="slot:"]`): the count stayed at the pre-edit value (3) through both keystrokes and only jumped straight to 13 on blur — no intermediate `rows=1` commit ever reached the store.
- [x] 3.4 Verify reverting on invalid input: type a non-numeric value or a value below the field's minimum, blur or press Enter, and confirm the field reverts to the last valid value rather than committing the invalid one. Verified on the DPI field: both `10` (below min 72) and `abc` (non-numeric) revert to the last committed value (150) on blur.
