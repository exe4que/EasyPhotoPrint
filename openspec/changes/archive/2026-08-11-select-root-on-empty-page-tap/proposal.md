## Why

The page-preview panel (`PageStage`) has two areas that currently ignore clicks/taps entirely: the root node's own margin (the padding band between the page edge and its first-level children, drawn today only as a decorative dashed outline) and the space outside the page rectangle itself (the scrollable viewport's background, visible when the page doesn't fill the panel or when zoomed out). Nothing there is selectable, so a user who taps there — instead of directly on a slot — gets no feedback and can't reach the page's own (root) Properties that way. Tapping either area to select the root gives the panel an always-available "select the page itself" gesture, on both desktop and mobile, without touching the parts of the panel that already have deliberate tap behavior.

## What Changes

- Tapping/clicking inside the root node's margin band (the area between the page edge and the root's padded content box, today just a `pointer-events-none` dashed outline) sets the selection to the root node.
- Tapping/clicking inside the page-preview viewport but outside the page rectangle's bounds (the scrollable background around the page) also sets the selection to the root node.
- Tapping/clicking the root selection again (same toggle convention slots already use) clears the selection.
- Explicitly out of scope, left unchanged: the gap space between sibling slots inside a `grid`/`horizontal`/`vertical` container (no gap-space handler is added), and a `freeformCanvas`'s own empty-area tap (it keeps selecting/placing on the canvas node itself, per the existing `canvas-interaction` spec — not overridden to select root).
- Applies identically on every host `PageStage` renders on today — the Electron desktop build and the Android build (`main.android.tsx`) share the same `App`/`PageStage`, with no separate mobile shell on `main` yet (the `responsive-shell` change that introduces `MobileShell`/`DesktopShell` and a Properties bottom sheet is still an open, unmerged PR) — so this reaches Android automatically once it's a normal part of `PageStage`, without depending on that other change landing first.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `canvas-interaction`: adds a new tap/click target — the page-preview panel's own empty space (root margin band and outside-the-page-bounds viewport area) — that selects the root node, alongside the existing slot/freeform/divider tap behaviors which are unaffected.

## Impact

- `src/components/canvas/PageStage.tsx`: add click handling for the root margin band and the viewport background around the page rectangle; no change to the existing slot, freeform-canvas, or divider handlers.
- No schema, store, or persistence changes — this reuses the existing `setSelection`/`clearSelection` actions and `{ kind: 'node', id: rootNode.id }` selection shape already used elsewhere.
