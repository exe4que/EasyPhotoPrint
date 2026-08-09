## Why

The archived `undo-redo` spec promises that "ui state changes are not tracked by the temporal store" — selecting an element, switching pages, or toggling layout mode should never create an undo step. That promise is currently false: `zundo`'s `temporal()` wrapper pushes a history entry on every `set()` call regardless of whether the tracked `document` slice actually changed, because the store configures a `partialize` but no `diff`/`equality`. Every UI-only setter (`setSelectedElementIds`, `setActiveTool`, `setActivePageId`, `setLayoutMode`, `clearSelection`) silently pollutes the undo/redo history and wipes the redo stack on every call. This was discovered empirically (by two independent review agents) during the `print-preview` change's adversarial review, and is fixed here as its own change since it's a pre-existing bug in an unrelated, already-archived capability.

## What Changes

- Configure `equality` on the store's `temporal(...)` call (`src/store/index.ts`) so a `set()` call whose partialized `document` reference is unchanged does not push a history entry — fixing the root cause once, for every current and future UI-only setter, instead of requiring a manual pause/resume wrap at each call site.
- Re-evaluate the two existing narrow workarounds for this same problem (`reanchorActivePageId`'s and `setViewMode`'s `pause()`/`resume()` wraps) now that the root cause is fixed, and simplify them if the equality fix makes them redundant.
- Add regression tests generalizing the existing `setViewMode` non-pollution test to the other affected UI-only setters, plus a positive-case test confirming a real document-mutating action still produces exactly one history entry.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `undo-redo`: the "History Scoped to the Document Slice Only" requirement's scenario "Selecting a different element does not create an undo step" currently does not hold for most UI-only actions; this change makes the store's actual behavior match what the requirement already documents.

## Impact

- `src/store/index.ts`: `temporal(...)` call gains an `equality` option; `reanchorActivePageId` and `setViewMode` potentially simplified.
- `src/store/index.test.ts`: new/generalized regression tests.
- No change to `src/store/uiSlice.ts`'s setter implementations themselves, to `documentSlice.ts`'s document-mutating actions, or to any UI component — this is confined to the store's temporal-tracking configuration.
