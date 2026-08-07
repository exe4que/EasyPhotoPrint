## Why

`document.pages` is already an array with each page carrying its own independent `pageConfig` and `rootNode` (`project-persistence` spec already documents this), but nothing in the app can grow, shrink, or navigate that array: `documentSlice.ts` has zero `addPage`/`removePage` actions, and `ui.setActivePageId` exists in the store but is never invoked from any component. A user is permanently stuck on the single page the document starts with. We want a document to hold multiple pages, each editable independently (including different Simple/Nested structures), before building the print-preview window (which will need to walk the whole document, not just one page).

## What Changes

- Add `addPage` and `removePage` actions to the document store: `addPage` appends a new page using the app's default `pageConfig` (A4 portrait) and a blank single-`imageSlot` `rootNode` (same shape `createDefaultPage` already produces), and makes it the active page. `removePage` deletes a page and refuses to go below one remaining page (the last page cannot be deleted).
- Add a simple page-switcher UI (tabs/stepper: "Page N of M" plus ◀ ▶, plus Add/Delete controls) — no page-reordering and no thumbnail previews in this change.
- `ui.layoutMode` (Simple/Nested) stops being a manually-set value that can go stale when switching pages: it is now derived automatically from the newly active page's own structure (via the existing `isSimpleModeCompatible` check) every time the active page changes, so a page built in Nested mode always opens showing the tree panel and a page that's still Simple-compatible always opens in Simple mode. Nothing new is persisted — this replaces the current fully independent, page-agnostic `layoutMode` toggle behavior for the specific case of switching pages; manually toggling the mode on the currently active page (the existing Simple/Nested buttons) is unchanged.
- Deleting the active page activates a sensible neighbor (the page that now occupies its former index, or the previous one if it was last) so the user is never left on a page that no longer exists.

## Capabilities

### New Capabilities
- `page-navigation`: adding/removing pages (with a one-page floor), the page-switcher UI, active-page selection on add/remove, and deriving the active Simple/Nested layout mode from the newly active page's structure when switching pages.

### Modified Capabilities
(none — `project-persistence`'s existing "pages array" and "PageConfig Is Independent Per Page" requirements already permit this without rewording, and `layout-engine`'s `isSimpleModeCompatible` check is consumed as-is, not changed.)

## Impact

- `src/store/documentSlice.ts` — new `addPage`/`removePage` actions.
- `src/store/uiSlice.ts` — `setActivePageId` recomputes `layoutMode` (in addition to the existing selection reset) from the newly active page's structure.
- `src/App.tsx` — new page-switcher UI (tabs/stepper + add/delete controls), replacing the currently-dead `activePageId` read with real navigation.
- No project file format changes — `EPPProject.pages` was already an array; this only adds ways to grow/shrink/navigate it.
