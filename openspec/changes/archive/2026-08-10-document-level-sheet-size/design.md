## Context

`PageConfig` (`packages/layout-engine/src/types.ts`) is currently shared by two unrelated things: `EPPTemplate.page` (a template's own structure-only page config, per `template-schema`) and `EPPProjectPage.pageConfig` (a project page's config, per `project-persistence`). Sheet size (`sizePreset`/`customSizeMm`) needs to stop being per-page for projects, but templates are still meant to be reusable structure blueprints applied across different documents/sizes — `template-schema`'s "Page config shape" requirement (already archived) still wants a template's own `page` to carry a full size/orientation/dpi suggestion. See proposal.md - Why for the motivation.

## Goals / Non-Goals

**Goals:**
- One sheet size per project, shared by every page, sourced from a single document-level field.
- Preserve per-page `orientation`/`dpi` exactly as they work today.
- Leave the `EPPTemplate`/`PageConfig` shape itself (a template's own size/orientation/dpi, used for standalone preview/thumbnail rendering) untouched — only the apply-to-page and export-from-page interactions gain new requirements for how they interact with the document's `sheetSize`.
- Existing `.eppproj` files on disk keep loading correctly.

**Non-Goals:**
- Not changing how templates store or preview their own page config.
- Not adding per-page overrides or exceptions to the shared sheet size (a page cannot opt out).
- Not changing DPI or orientation semantics.

## Decisions

### 1. New document-level `sheetSize` field, `PageConfig` untouched for templates

`EPPProject` (and the renderer's `DocumentState`) gains a `sheetSize: { sizePreset: PageSizePreset; customSizeMm?: { widthMm; heightMm } }` field. `EPPTemplate.page` keeps using the existing `PageConfig` type exactly as `template-schema` specifies (no change to that capability). `EPPProjectPage.pageConfig` switches to a new, narrower type carrying only `orientation` and `dpi` — call it `ProjectPageConfig`.

Alternative considered: keep `sizePreset`/`customSizeMm` on `PageConfig` and just have every page's copy of it forced to stay in sync programmatically (write-through to all pages on change). Rejected — it re-introduces the exact "pages can in principle diverge" shape the proposal is trying to remove, just enforced by convention instead of by the data model; a stray code path (e.g. a future template apply) could silently desync one page.

### 2. `resolvePageSizeMm`/`createPageBoxMm` take `sheetSize` and a page's `orientation` as separate arguments

`src/lib/page.ts` currently takes one `PageConfig` (which had both size and orientation together). It now takes the document's `sheetSize` plus the specific page's `orientation`, and returns the same oriented `{ widthMm; heightMm }`/`BoxMm` as before. Every call site (`documentSlice.ts`, PDF composition, print preview) already has both values available (one project, one active/target page) so this is a mechanical signature change, not a new lookup.

### 3. Applying a template no longer touches sheet size

`documentSlice.applyTemplate` currently does `pageConfig: { ...template.page }`, replacing the whole per-page config including size. Since size is no longer part of a page's own config, this becomes `pageConfig: { orientation: template.page.orientation, dpi: template.page.dpi }` — the template's own `sizePreset`/`customSizeMm` are read (for template preview/thumbnail purposes elsewhere) but never written into a project page. This matches user expectation: applying a template changes structure and suggests an orientation/DPI, but never silently resizes the whole document's sheet.

`exportTemplate`/`createTemplateFromPage` (going the other direction — page → template) still needs a `sizePreset`/`customSizeMm` to put in the exported `EPPTemplate.page`, since `template-schema` requires it. It uses the project's current `sheetSize` at export time (a reasonable snapshot — the template doesn't stay linked to it afterward, same as today's template/page relationship).

### 4. Migration derives `sheetSize` from the first page

`migrateProject` in `packages/migrations/src/index.ts` already treats a project's shape structurally (fields are checked for presence/type, not gated behind a version-number branch), so no schema-version bump was needed: for a document with no top-level `sheetSize` (a pre-change file), it reads `pages[0].pageConfig.sizePreset`/`customSizeMm` as the derived `sheetSize` (falling back to `A4` if `pages` is empty or the first page's config is malformed). "Stripping" `sizePreset`/`customSizeMm` off every page happens for free downstream: the per-field assertor that builds each `EPPProjectPage.pageConfig` (`assertProjectPageConfig` in `electron/main/ipc/fs.helpers.ts`) only ever reads `orientation`/`dpi` off the raw record, regardless of what else is present. If pre-change pages actually had different sizes (something the old spec allowed "in principle" but the UI never exposed a way to diverge them, since every page started from the same default and there was no per-document bulk-size action), those differing sizes are silently collapsed to the first page's — this is called out explicitly to the user below since it's a real, if narrow, migration data-loss edge case.

## Risks / Trade-offs

- [A pre-change project that does have genuinely different page sizes (only reachable by manually editing pageConfig per page today) loses that per-page size on migration] → Acceptable: the UI never offered a supported way to create such a project, and the new model intentionally forbids it going forward. Flagging this to the user rather than silently declaring no risk.
- [`ProjectPageConfig` and `PageConfig` now look similar but are different types] → Mitigated by keeping both names distinct in `@epp/layout-engine` exports and updating every call site's type at once so `tsc` catches any remaining `sizePreset`/`customSizeMm` access on a project page.

## Migration Plan

Implemented as part of the normal `migrateProject` schema-version bump (`packages/migrations`) — no separate rollout step. Rollback is the normal revert-the-commit path; there is no external system to coordinate with (single-user local `.eppproj` files).
