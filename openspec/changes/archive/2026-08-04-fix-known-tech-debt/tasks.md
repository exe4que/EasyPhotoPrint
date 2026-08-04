## 1. Wire slot-to-slot drag-and-drop

- [x] 1.1 Extend `useDragAndDrop.ts`: `createImageDragProps` accepts a `source: 'library' | 'page'` parameter and sets it as a second `dataTransfer` key at drag start; `createSlotDropProps`'s `onDrop` reads both keys and calls its callback as `(imageAssetId, source)`
- [x] 1.2 In `PageStage.tsx`, spread `createImageDragProps(page.assignments[id], 'page')` onto `imageSlot` elements that currently have an assignment (in addition to their existing drop/click handlers); pass `'library'` explicitly for the `ImageLibraryPanel.tsx` call site
- [x] 1.3 Thread the resolved `source` from the slot drop callback through to `assignImageToSlot(page.id, id, imageAssetId, source)`
- [x] 1.4 In `src/store/documentSlice.ts`, add the `source` parameter to the `assignImageToSlot` action (default `'library'`) and forward it to `assignImageToPage`
- [x] 1.5 Add/extend unit tests in `documentSlice.test.ts` (or a UI-level test if one exists for `PageStage.tsx`) covering: slot-to-slot swap, slot-to-empty-slot move, and library-drag-always-replaces-even-if-image-used-elsewhere-on-page

## 2. Remove stale, unused JSON Schema files

- [x] 2.1 Delete `shared/schemas/template.schema.json` and `shared/schemas/project.schema.json`
- [x] 2.2 Confirm no remaining references (`grep -r "schemas/template\|schemas/project"`) and that `shared/schemas/` is either removed if now empty or left as-is if other files remain

## 3. Verify

- [x] 3.1 `npm run typecheck`
- [x] 3.2 `npm run test`
- [x] 3.3 Manually verify in the running app: drag an assigned slot's image onto another assigned slot (swap), onto an empty slot (move), and drag a library image already used on the page onto a slot (still a plain replace)
