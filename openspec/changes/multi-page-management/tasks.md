## 1. Layout mode follows the active page

- [x] 1.1 In `src/store/uiSlice.ts`, import `isSimpleModeCompatible` from `@epp/layout-engine` and have `setActivePageId` recompute `layoutMode` from the newly active page's `rootNode` (`isSimpleModeCompatible(nextPage.rootNode) ? 'simple' : 'nested'`) in the same `set()` call that already updates `activePageId` and `selectedElementIds`. Guard for `nextPage` being `undefined` (keep current `layoutMode` if the target id doesn't resolve to a page, matching the existing defensive pattern used elsewhere).

## 2. Page CRUD in the store

- [x] 2.1 In `src/store/index.ts`, add an `addPage: () => void` action (same composition style as `startNewProject`): append `createDefaultPage()` (imported from `documentSlice.ts`) to `document.pages` and activate it. **Deviation from the original plan**: activation is folded into the *same* `set()` call as the page append (via `computeActivePageUi`, extracted from `setActivePageId` in `uiSlice.ts`) rather than calling `get().setActivePageId(...)` as a second `set()` call — zundo pushes one history entry per `set()` call regardless of whether the tracked `document` slice actually changed in that call, so two calls fragmented a single "Add Page" into two undo steps (caught during task 5.3 verification). See design.md.
- [x] 2.2 In `src/store/index.ts`, add a `removePage: (pageId: string) => void` action: no-op if `document.pages.length <= 1`. Otherwise remove the page at that id and, if it was the active page, activate the neighbor per the spec (the page that shifts into the removed page's old index, or the previous page if it was last) — same single-`set()`-call fix as `addPage` (task 2.1) applies here.
- [x] 2.3 Add both actions to the `EPPStore` type in `src/store/index.ts`.

## 3. Page switcher UI

- [x] 3.1 Add a small page-switcher component (e.g. `src/components/panels/PageSwitcher.tsx` or inline in `App.tsx`, match the file-organization convention already used for header controls) showing "Page N of M", previous/next buttons (disabled at the first/last page, no wraparound), an "Add Page" button, and a "Remove Page" button (disabled when `document.pages.length <= 1`).
- [x] 3.2 Wire the component's controls to `setActivePageId` (prev/next), `addPage`, and `removePage(activePageId)` from the store.
- [x] 3.3 Place it in `App.tsx`'s header, near the existing Preview-adjacent controls (or wherever fits the current header layout best) — this is the first real consumer of `ui.activePageId` from a component, so double check every existing per-page panel (`PageSetupPanel`, `LayoutTreePanel`, `ImageLibraryPanel`, `PropertiesPanel`, `SelectionPanel`, `SaveTemplateDialog`) correctly reflects the newly active page when it changes (they already derive from `ui.activePageId` reactively, so this should be automatic — verify, don't assume).

## 4. Tests

- [x] 4.1 Unit test `addPage`: appends a page with the app's default `pageConfig` (A4/portrait), a blank single-`imageSlot` `rootNode`, empty `assignments`; leaves other pages untouched; the new page becomes active.
- [x] 4.2 Unit test `removePage`: removes a non-active page without touching others; no-ops when only one page remains; removing the active (non-last) page activates the page that shifts into its old index; removing the active page when it's last activates the new last page.
- [x] 4.3 Unit test `setActivePageId`'s layout-mode derivation: switching to a page whose `rootNode` is Simple-compatible sets `layoutMode` to `'simple'`; switching to a non-compatible one sets it to `'nested'`, regardless of the previous value.

## 5. Verification

- [x] 5.1 Run the app: add a page, confirm it's blank/A4/portrait and becomes active; build a nested structure on it, add another page, confirm the new one is blank again (not inheriting the previous page's structure) and opens in Simple mode; navigate back to the nested page and confirm it opens in Nested mode automatically. Verified end-to-end under `xvfb` with Playwright's `_electron` (real button clicks, real `<select>` interactions to retype a node into a genuinely Nested-only two-level structure).
- [x] 5.2 Confirm previous/next don't wrap around at the first/last page, and Remove Page is disabled/no-op with only one page left. Verified in the same E2E run.
- [x] 5.3 Confirm undo after "Add Page" removes the page and leaves the UI on a valid page (no crash, no stale `activePageId` reference visible). Verified via the real `Edit > Undo` menu item's `click()` handler (main → IPC → renderer → store), end-to-end. Caught and fixed a real bug here — see task 2.1's note and design.md.
- [x] 5.4 `npm run typecheck` and `npm run test` pass. 137/137 tests pass (7 new: `addPage`/`removePage` behavior + one-undo-step regression tests, layout-mode derivation).
- [x] 5.5 `openspec validate --strict` for this change passes.
