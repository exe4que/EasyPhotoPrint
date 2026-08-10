## Why

`PageConfig.sizePreset`/`customSizeMm` today live independently on every `EPPProjectPage`, so a project can in principle mix page sizes (A4 next to 4x6 in the same document). That is inconsistent with `Print` and `Export PDF`, which always operate on the *entire* project as one job: a single physical print job realistically loads one sheet size, not a different one per page. Making sheet size a single document-level setting removes that inconsistency and matches how the user actually thinks about a project — one sheet size, many pages laid out on it. Orientation and DPI are left as page-level settings since mixing portrait/landscape pages (or different DPI) within one sheet size is still a legitimate, common case.

## What Changes

- **BREAKING**: `sizePreset` and `customSizeMm` move off `EPPProjectPage.pageConfig` onto a new document-level `sheetSize` field (`EPPProject.sheetSize` / `document.sheetSize` in the renderer store). Every page in a project now shares the same sheet size; it can no longer be set or read per page.
- Each page's `pageConfig` shrinks to just `orientation` and `dpi`, which remain independently editable per page as today.
- `PageSetupPanel`'s page-size selector moves out of the per-page panel into a document-level setting (editable regardless of which page is active); orientation and DPI stay in the per-page panel.
- A new `updateSheetSize` store action replaces sheet-size patches that used to go through `updatePageConfig`; `updatePageConfig` narrows to `orientation`/`dpi` patches only.
- Applying a template to a page (`applyTemplate`) stops copying the template's `page.sizePreset`/`customSizeMm` onto the page — only `orientation`/`dpi` are still adopted from the template. Exporting a page as a template (`exportTemplate`) now snapshots the project's current document-level sheet size into the exported template's `page.sizePreset`/`customSizeMm` (a page no longer carries that value itself). The template's own `page` *shape* (used for standalone preview/thumbnail rendering) and the rest of `template-schema` are otherwise unaffected — templates keep carrying their own `sizePreset`/`customSizeMm` as a structure-only concept independent of any project.
- `.eppproj` files gain a top-level `sheetSize` field. Loading a pre-existing `.eppproj` (schema version predating this change) migrates it by taking the first page's `sizePreset`/`customSizeMm` as the new document-level `sheetSize` and dropping those fields from every page's `pageConfig`.
- "Add Page" no longer stamps a new page with its own A4 default size — the new page simply uses the document's current `sheetSize`; its own `pageConfig` still defaults to portrait/300dpi.
- `printing` and `pdf-export` requirement text that described pages "in principle" carrying different sizes is corrected: every page in one print/export job now always shares the same sheet size, so that language is dropped. Orientation may still differ per page, so the existing "to the extent the printer/driver support it" caveat is kept for orientation only.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `project-persistence`: `EPPProject`/`document` data model gains a document-level `sheetSize`; `PageConfig` per page narrows to `orientation`/`dpi` only; `.eppproj` file shape and the legacy-file migration path both change accordingly.
- `page-navigation`: "Adding a Page" no longer sets the new page's own size — it inherits the document's `sheetSize` by construction, since size is no longer part of a page's own config.
- `printing`: drops the "varying page size" caveat in "Print Sends Every Page" now that all pages in a project always share one sheet size; keeps the driver-support caveat for orientation only.
- `pdf-export`: drops the "pages have different configured sizes" scenario in favor of "pages may have different orientations" (size is now always uniform across a project's pages).
- `template-schema`: applying a template to a page no longer changes the document's sheet size (only orientation/DPI are adopted); exporting a page as a template now snapshots the document's current sheet size into the exported template's `page` field.

## Impact

- `packages/layout-engine/src/types.ts`: `PageConfig` used by `EPPTemplate.page` is untouched; a new narrower per-page type (e.g. `ProjectPageConfig`) is introduced for `EPPProjectPage.pageConfig`, and `EPPProject` gains `sheetSize: { sizePreset; customSizeMm? }`.
- `src/store/documentSlice.ts`: `DocumentState` gains `sheetSize`; `createDefaultPage`/`createInitialDocumentState` updated; new `updateSheetSize` action; `updatePageConfig` narrows its patch type; `applyTemplate` stops copying size fields from the template.
- `src/lib/page.ts`: `resolvePageSizeMm`/`createPageBoxMm` take the document's `sheetSize` plus the page's `orientation` instead of a single `pageConfig` carrying both.
- `src/components/panels/PageSetupPanel.tsx`: page-size selector becomes document-scoped (not keyed to the active page); orientation/DPI stay page-scoped.
- `packages/migrations/src/index.ts`: `migrateProject` gains a step that derives `sheetSize` from the first page and strips size fields from every page for pre-change schema versions.
- `electron/main/ipc/*` (templates/fs helpers), `electron/main/pdf/composeProjectPdf*`: read `sheetSize` from the project plus each page's `orientation`/`dpi` instead of each page's own size fields.
- Tests referencing `pageConfig.sizePreset`/`customSizeMm` on `EPPProjectPage` fixtures (documentSlice, uiSlice, store index, composeProjectPdf, templates.helpers, fs.helpers, migrations) need updating to the new shape.
