## Why

While baselining the current codebase into OpenSpec (`baseline-capture-existing-specs`), the drafting agents verified two things against real code that turned out to be broken: the tested slot-swap logic in the store is never reachable from the UI, and the two JSON Schema reference files under `shared/schemas/` are stale, unused, and out of sync with the actual runtime shape. Both are cheap to fix now, before the upcoming project-persistence and printing work builds more on top of the same files.

## What Changes

- Wire slot-to-slot drag-and-drop in the canvas: an already-assigned `imageSlot` becomes a drag source (not just a drop target), and the drop handler distinguishes "dragged from the Image Library panel" from "dragged from another slot on the same page" so `assignImageToPage`'s existing `source: 'page'` swap path actually gets invoked instead of always taking the `'library'` replace path.
- Delete `shared/schemas/template.schema.json` and `shared/schemas/project.schema.json`: neither is referenced by any code (no `ajv` or JSON-Schema validation dependency exists in the project), and both have drifted from the real runtime shape in `packages/layout-engine/src/types.ts` (missing the `specificSize` scaling rule and `specificSizeMm` entirely). Structural validation of templates/projects already happens elsewhere (`packages/migrations`, `electron/main/ipc/templates.helpers.ts`), per the already-archived `template-schema` spec's "Templates Are Loaded Through a Schema Migration Step" requirement — these files added no behavior, just misleading, unmaintained duplication.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `project-persistence`: the "Assignment Logic Swaps When the Source Is Another Slot on the Same Page" requirement currently documents the swap path as implemented-but-unreachable from the UI; this change makes it reachable, so the requirement text and its scenarios need to reflect that slot-to-slot dragging is now wired up.

## Impact

- Affected code: `src/hooks/useDragAndDrop.ts` (drag-source/drop-target props gain a source marker), `src/components/canvas/PageStage.tsx` (assigned slots become draggable; drop handler passes the resolved source through), `src/store/documentSlice.ts` (`assignImageToSlot` action forwards `source` to `assignImageToPage`, which already implements the swap logic and is already unit-tested).
- Deleted: `shared/schemas/template.schema.json`, `shared/schemas/project.schema.json`. No code imports either file (verified via repo-wide grep), so no other file changes as a result.
- No schema/IPC/data-model changes — this only wires up UI behavior that already exists and is tested in the store, and removes two orphaned files.
