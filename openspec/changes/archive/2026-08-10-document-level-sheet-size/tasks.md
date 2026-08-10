## 1. Data model

- [x] 1.1 In `packages/layout-engine/src/types.ts`, add a `SheetSize` type (`{ sizePreset: PageSizePreset; customSizeMm?: { widthMm; heightMm } }`) and a `ProjectPageConfig` type (`{ orientation: 'portrait' | 'landscape'; dpi: number }`). Leave `PageConfig` (used by `EPPTemplate.page`) unchanged.
- [x] 1.2 Change `EPPProjectPage.pageConfig` to `ProjectPageConfig` and add `sheetSize: SheetSize` to `EPPProject`.
- [x] 1.3 Update `packages/layout-engine` barrel exports for the new types.

## 2. Layout resolution helpers

- [x] 2.1 In `src/lib/page.ts`, change `resolvePageSizeMm`/`createPageBoxMm` to accept `sheetSize: SheetSize` and `orientation: 'portrait' | 'landscape'` as separate arguments instead of one `PageConfig`.
- [x] 2.2 Update every call site (`documentSlice.ts`, PDF composition, print preview, any UI reading page size) to pass `document.sheetSize`/project `sheetSize` plus the target page's `orientation`.

## 3. Renderer store

- [x] 3.1 In `src/store/documentSlice.ts`: add `sheetSize` to `DocumentState`, default it to `A4` in `createInitialDocumentState`; update `DEFAULT_PAGE_CONFIG`/`createDefaultPage` to only set `orientation`/`dpi`.
- [x] 3.2 Add an `updateSheetSize` action (patches `document.sheetSize`, same merge semantics `updatePageConfig` has today for `customSizeMm`) and narrow `updatePageConfig`'s patch type to `Partial<ProjectPageConfig>`.
- [x] 3.3 Update `applyTemplate` to set `pageConfig: { orientation: template.page.orientation, dpi: template.page.dpi }` instead of spreading the whole `template.page`, per the `template-schema` "Applying a Template Never Changes the Document's Sheet Size" requirement.
- [x] 3.4 Update `createTemplateFromPage`/`exportTemplate` to build the exported `EPPTemplate.page` from `{ sizePreset, customSizeMm }` off the project's current `sheetSize` plus `{ orientation, dpi }` off the exporting page's `pageConfig`, per the `template-schema` "Exporting a Page as a Template Snapshots the Document's Sheet Size" requirement.
- [x] 3.5 Update `src/store/index.ts`'s `buildEppProject` to include `sheetSize` in the assembled `EPPProject` payload used for save/PDF/print IPC calls.

## 4. UI

- [x] 4.1 Move the page-size selector (and, when `sizePreset === 'Custom'`, the width/height fields) out of `PageSetupPanel`'s per-page section into a document-scoped control, reading/writing `document.sheetSize` via `updateSheetSize` regardless of which page is active.
- [x] 4.2 Keep orientation and DPI controls in `PageSetupPanel` wired to the active page's `pageConfig` via `updatePageConfig`, unchanged in behavior.
- [x] 4.3 Update the panel's description text (currently states `pageConfig` "does not affect the rest of the document" — no longer true for size, which now is document-wide) to reflect the split between document-level size and per-page orientation/DPI.

## 5. Persistence and migration

- [x] 5.1 In `packages/migrations/src/index.ts`, add a migration step: for a project with no top-level `sheetSize` (a pre-change file), derive it from `pages[0].pageConfig.sizePreset`/`customSizeMm` (falling back to `A4` if `pages` is empty or the first page's config is malformed). (No schema-version bump was needed -- the existing `migrateProject` already treats `pages`/fields structurally rather than gating behavior by a version string, so this is a presence check, not a version branch.)
- [x] 5.2 Update `electron/main/ipc/fs.helpers.ts` to validate/round-trip the new top-level `sheetSize` field (`assertSheetSize`), and to validate each page's `pageConfig` with a new `assertProjectPageConfig` (orientation/dpi only) instead of the template-shaped `assertPageConfig`.
- [x] 5.3 Confirmed `electron/main/ipc/templates.helpers.ts`'s `assertPageConfig` needs no change — it now validates only `EPPTemplate.page`, its sole remaining caller.

## 6. PDF export and printing

- [x] 6.1 Update `electron/main/pdf/composeProjectPdf*` to read sheet size from the project's `sheetSize` and each page's own `orientation`/`dpi`, instead of each page's `pageConfig.sizePreset`.
- [x] 6.2 Update the print IPC handler equivalently, sourcing sheet size from `sheetSize` and orientation per page.

## 7. Tests

- [x] 7.1 Update fixtures/assertions in `src/lib/page.test.ts`, `src/store/uiSlice.test.ts`, `src/store/documentSlice.test.ts`, `src/store/index.test.ts` to the new `sheetSize`/`ProjectPageConfig` shape.
- [x] 7.2 Update `electron/main/pdf/composeProjectPdf.helpers.test.ts`, `electron/main/ipc/templates.helpers.test.ts` (confirmed unaffected), `electron/main/ipc/fs.helpers.test.ts` accordingly.
- [x] 7.3 Update `packages/migrations/src/index.test.ts` with cases that migrate a legacy fixture (per-page `sizePreset`, including a `Custom` preset with `customSizeMm`, and the "manually diverged pages" case) into the new `sheetSize` shape, plus the empty-pages fallback-to-A4 case.
- [x] 7.4 Add/adjust tests for `applyTemplate` (sheet size untouched, orientation/dpi adopted) and `exportTemplate` (exported `page.sizePreset` matches the project's current `sheetSize`); added `updateSheetSize` coverage too.

## 8. Verification

- [x] 8.1 Run the full test suite and typecheck.
- [x] 8.2 Manually verified end-to-end in the real Electron app (Playwright `_electron` driver under xvfb): the Page Setup panel now shows a document-scoped "Page size (whole document)" selector plus per-page "Orientation (this page)"/"DPI (this page)" controls; changing sheet size on page 1 to Letter and setting it to landscape, then adding page 2, showed page 2 inheriting Letter (document-wide) while defaulting to its own portrait orientation; navigating back to page 1 showed Letter + landscape both preserved, confirming per-page orientation independence from the shared sheet size. Export PDF was driven end-to-end through the real IPC path (native save dialog stubbed at the Electron `dialog` module) and produced a valid multi-page PDF file. The legacy-`.eppproj`-migration path is covered by the `packages/migrations`/`fs.helpers` unit tests added in 7.2/7.3 rather than re-verified manually, since it exercises the same `migrateProject`/`normalizeProjectDocument` code paths already under direct test.
- [x] 8.3 Ran `openspec validate --strict --changes document-level-sheet-size` — passes.
