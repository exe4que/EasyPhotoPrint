## Why

The user's actual gap, clarified after an earlier proposal on this same topic: they can set a root node's padding (margins) in the Properties panel for every root type except `imageSlot` — the most common case, since the default single-slot template's root is a plain `imageSlot`. This isn't a data-model or layout-engine limitation (`paddingMm` already works on `imageSlot`, per the `layout-engine` capability's "imageSlot's own padding shrinks its recorded box" requirement); it's that the archived `properties-panel` spec's "Selecting an imageSlot shows its slot properties" scenario deliberately lists only scaling/rotation/size controls, with no padding — unlike `grid`/`horizontal`/`vertical`/`freeformCanvas`, which already show it. This change closes exactly that gap, in place, rather than adding a second, page-level control elsewhere (the approach from the cancelled `page-setup-margins` proposal).

## What Changes

- The Properties panel's "Slot properties" view (shown when an `imageSlot` is selected, or is the root shown by default) gains a padding control (top/right/bottom/left, in the active unit system) — the same `renderPaddingInputs`/`CommitLengthInput` UI already used for `grid`/`horizontal`/`vertical`/`freeformCanvas`.
- Applies to every `imageSlot`, not just root ones — a non-root `imageSlot` (e.g. a grid cell) gets the same padding control, consistent with how every other node type already exposes it regardless of nesting depth.
- No data model, layout engine, or persistence changes — `paddingMm` already round-trips correctly for `imageSlot` nodes today; this only adds the missing UI control.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `properties-panel`: the "Properties Panel Shows Content Appropriate to the Selection" requirement's `imageSlot` scenario is updated to include padding among the controls shown, matching what container types already get.

## Impact

- `src/components/panels/PropertiesPanel.tsx`: add `renderPaddingInputs(...)` to the `imageSlot` ("Slot properties") branch, reading/writing `slotPropertyNode.paddingMm` via the existing `updateLayoutNode` action — the same pattern already used for `grid`/`horizontal`/`vertical`/`freeformCanvas`.
