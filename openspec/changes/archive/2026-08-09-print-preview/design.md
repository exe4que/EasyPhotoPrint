## Context

`PageStage.tsx` is the only place today that turns a resolved layout (`useLayoutResolution()`) into pixels: it walks `layout` entries for `imageSlot`, `freeformCanvas`, and flex-container nodes, and inline (~lines 330-402) computes each image's rendered rect via `computeImageRenderRectMm`/`computeImageDisplayRectMm` (`src/lib/imageDisplay.ts`) and paints an `<img>` at that rect. All of that is wrapped in the same JSX nodes that also carry click/hover/drag handlers, selection borders, and dimension overlays — the visual and the interactive are not separated. `FreeformElementView` (`src/components/canvas/FreeformElement.tsx`) has the same shape: one component that both computes the image's display rect and owns move/resize/rotate drag handlers plus selection chrome.

There is no router in this app (`src/App.tsx` is one component tree), and `ui` state (`src/store/uiSlice.ts`) is already the established place for view state excluded from zundo undo/redo tracking (`layoutMode`, `activeTool`, `selectedElementIds`).

## Goals / Non-Goals

**Goals:**
- One rendering path for "how an image looks in its box," shared by the editor canvas and the new preview screen, so the two can never visually diverge.
- Preview mode as a first-class `ui.viewMode`, not a route or a modal overlay.

**Non-Goals:**
- Extracting or sharing anything about *interaction* (drag, resize, rotate, hover, drop targets) — preview has none of that; only the passive rendering math is shared.
- Touching the flex-container divider or grid-layout rendering path — preview does not show dividers or container outlines at all, so nothing there needs extracting.
- Any change to how `pdf:export`/`print:document` IPC handlers work — out of scope per the proposal.

## Decisions

### Extract a shared, presentation-only image renderer
Pull the "given an asset, a resolved box, and scaling/rotation config, render the `<img>` at its computed rect" logic out of both `PageStage.tsx`'s inline slot rendering and `FreeformElementView`'s body into a single small presentational component (e.g. `SlotImage`), taking exactly the inputs `computeImageRenderRectMm`/`computeImageDisplayRectMm` already need (asset, box, scalingRule, specificSizeMm, rotationDeg) plus zoom, and rendering only the `<img>` (or the "missing image" fallback). `PageStage` and `FreeformElementView` keep their own wrapping `<div>` for interaction/selection/overlays; the preview screen wraps the same `SlotImage` with nothing.

Alternative considered: let the preview screen call `computeImageRenderRectMm`/`computeImageDisplayRectMm` directly and write its own `<img>` JSX in parallel to `PageStage`'s. Rejected per prior discussion with the user — two independent places drawing "an image in a box" is exactly the kind of drift a shared component prevents, and the extraction is small (the pure math already lives in `imageDisplay.ts`; only the JSX that consumes it is duplicated today).

### `ui.viewMode` as untracked UI state
Add `viewMode: 'editor' | 'preview'` to `UiState` (`src/store/uiSlice.ts`) with a `setViewMode` action, following the exact pattern `layoutMode`/`activeTool` already use. `zundo`'s `partialize` only tracks `document`, so the *content* of an undo/redo snapshot never includes `viewMode` — but `zundo` pushes a new pastState on every `set()` call regardless of whether the tracked slice actually changed (no `equality`/`diff` option is configured), so a plain ui-only `set()` still pushes a redundant (content-identical) history entry. `store/index.ts` already has exactly this problem for `reanchorActivePageId`'s ui-only re-anchoring, and already solves it the same way: `useEPPStore.temporal.getState().pause()`/`.resume()` around the `set()` call. `store/index.ts` overrides `createUiSlice`'s plain `setViewMode` with a version wrapped in that same pause/resume, so toggling preview provably never produces an undo/redo entry (covered by a regression test in `src/store/index.test.ts`), rather than merely "not polluting the content of" one.

Alternative considered: local component state (`useState` in `App.tsx`). Rejected because `App.tsx`'s Escape-key handler and the header button both need to read/set this value, and because a future page-navigation-from-preview interaction needs it alongside `activePageId` — the store is already the shared source of truth for both.

### Preview screen as a sibling top-level render branch in `App.tsx`
`App.tsx`'s root renders either the existing editor JSX or a new `PreviewScreen` component based on `ui.viewMode`, both still inside the existing `<main>` shell. `PreviewScreen` gets its own page data via the same `useLayoutResolution()` hook the editor uses (it already reads `ui.activePageId`), so switching pages inside preview is just calling the existing `setActivePageId`.

Alternative considered: keep `PageStage` mounted and overlay a full-screen preview layer on top. Rejected — `PageStage` carries drag-and-drop listeners and hover state that have no reason to stay mounted (and no way to visually hide) while preview is showing; a clean branch is simpler and avoids any chance of an editor-only interaction leaking through.

### Escape precedence
`App.tsx`'s existing `keydown` effect (currently: Escape → `clearSelection()`) is extended to check `ui.viewMode` first: in `'preview'`, Escape calls `setViewMode('editor')` and returns, never reaching `clearSelection()`. This keeps the two behaviors mutually exclusive per the spec's "Escape does not also clear editor selection on exit" scenario, and avoids the alternative of two separate `keydown` listeners fighting over the same key.

## Risks / Trade-offs

- [Risk] Extracting `SlotImage` out of `PageStage` touches working, spec-anchored (`layout-engine`) rendering code — a mistake in the extraction could visually regress the editor. → Mitigation: the extraction is a pure refactor of JSX consuming already-tested pure functions (`computeImageRenderRectMm`/`computeImageDisplayRectMm`); no behavior in `layout-engine` or `imageDisplay.ts` changes, and the editor's existing visual behavior (per `canvas-container-outlines` and `layout-engine` specs) must be manually re-checked after the refactor since those specs describe outcomes this change must not disturb.
- [Risk] Fit-to-screen sizing for the preview page reuses `PageStage`'s existing `computeFitZoom` pattern (resize-observed viewport / page-at-zoom-1 ratio) — getting the container ref or observer wrong could show clipped or tiny pages. → Mitigation: reuse the same `clampZoom`/fit-zoom computation approach already proven in `PageStage.tsx`, adapted to the preview's own full-viewport container.

## Open Questions

None — the prior explore-mode discussion resolved the design-affecting unknowns (multi-page navigation, exit interactions, empty-slot rendering, shared-renderer extraction, capability naming) before this change was proposed.
