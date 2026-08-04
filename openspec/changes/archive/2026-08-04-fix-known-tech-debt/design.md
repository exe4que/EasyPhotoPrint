## Context

Two independent pieces of pre-existing debt, both found while verifying the baseline specs against real code:

1. `assignImageToPage(page, nodeId, imageAssetId, source)` in `src/store/documentSlice.ts` already implements and unit-tests the `source: 'page'` swap path, but `assignImageToSlot` (the store action the UI calls) always invokes it without a `source`, so it's hard-coded to `'library'`. Native HTML5 drag-and-drop is set up via `src/hooks/useDragAndDrop.ts`: `createImageDragProps` (drag source) is only wired to `ImageLibraryPanel.tsx`'s cards; `createSlotDropProps` (drop target) is wired to every `imageSlot` in `PageStage.tsx`, but slots themselves are never made draggable, so slot-to-slot dragging is currently impossible in the UI, not just "not routed to swap."
2. `shared/schemas/template.schema.json` and `shared/schemas/project.schema.json` are hand-written JSON Schema documents. A repo-wide grep found zero references to either file from any source file, and no `ajv` or other JSON-Schema validation library is a project dependency — nothing ever executes them. Both are missing the `specificSize` scaling rule (`imageSlotConfig.scalingRule` enum and `specificSizeMm`) that exists in `packages/layout-engine/src/types.ts` and is exercised throughout the layout engine.

## Goals / Non-Goals

**Goals:**
- Make the already-implemented, already-tested slot-swap logic reachable through the actual UI drag gesture.
- Remove the two schema files' drift and the maintenance burden of a second, unenforced description of the document shape.

**Non-Goals:**
- Not introducing JSON-Schema-based runtime validation (e.g. via `ajv`) as a new capability. Structural validation of templates/projects is already a documented, working requirement (`template-schema`'s "Templates Are Loaded Through a Schema Migration Step", implemented in `packages/migrations` + `electron/main/ipc/templates.helpers.ts`); adding a second, parallel validation mechanism is a bigger feature decision than "fix the debt that was found" and is out of scope here.
- Not changing `assignImageToPage`'s swap algorithm itself — it's correct and already covered by unit tests. This change is purely about making the UI invoke it with the right `source`.

## Decisions

**How the canvas learns a drag originated from a slot vs. the library**: extend the existing `dataTransfer`-based mechanism in `useDragAndDrop.ts` with a second key, `application/x-epp-image-drag-source`, set to `'library'` or `'page'` at `dragstart` alongside the existing image-id payload. `createSlotDropProps`'s `onDrop` reads both keys and passes `(imageAssetId, source)` to its caller.
- *Alternative considered*: keep a "currently dragged node id" in React/store state instead of `dataTransfer`. Rejected — it would require lifting drag state through `PageStage.tsx` alongside the native DOM drag events already in play, duplicating information the browser already carries for us via `dataTransfer`, for no benefit.
- *Alternative considered*: infer swap-vs-replace purely from "is this image already assigned elsewhere on this page," without an explicit source marker. Rejected — this is exactly the behavior the already-archived `project-persistence` spec rules out: dragging from the Image Library panel must always be a plain replace regardless of the image's prior assignment state, so the origin has to be signaled explicitly, not inferred from assignment state.

**Assigned slots become drag sources**: in `PageStage.tsx`, an `imageSlot` with a current assignment spreads `createImageDragProps(page.assignments[id], 'page')` (in addition to its existing `createSlotDropProps` drop handlers and its `onClick` selection handler — these are independent DOM event handlers and don't conflict). Empty slots remain drop-target-only, since there's nothing to drag out of them.

**`assignImageToSlot` gains a `source` parameter**: threaded from the store action down to `assignImageToPage`, defaulting to `'library'` to preserve existing call sites (e.g. the freeform-canvas drop path, which only ever originates from the library today) that don't pass one explicitly.

**Delete rather than sync the two schema files**: syncing them would still leave them unused and therefore silently re-driftable the next time a schema field changes, since nothing would fail if they went stale again. Deleting removes the liability outright; if JSON-Schema-based external validation becomes a real need later (e.g. for third-party tooling), it should be proposed as its own change with an explicit wiring decision, not resurrected as an unused artifact.

## Risks / Trade-offs

- [Risk] A user mid-drag from the library could theoretically also have a stale `'page'` marker left over from a previous drag if `dataTransfer` weren't correctly reset per-gesture → Mitigation: `dataTransfer` is scoped to a single native drag gesture by the browser itself; each `dragstart` sets fresh keys, so there's no cross-gesture leakage to guard against in application code.
- [Risk] Deleting the schema files could surprise someone relying on them as documentation → Mitigation: `openspec/specs/template-schema/spec.md` (already archived) documents the same shape in prose/requirement form and is the actual source of truth going forward; the JSON files added no information beyond what's already there, just in a format nothing consumes.
