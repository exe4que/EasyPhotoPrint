## Context

See `proposal.md` - Why/What Changes for motivation and scope. Relevant existing pieces this design builds on:

- `electron-shell` already establishes the architecture this change must follow: the Main process never touches renderer/document state directly; it only exchanges explicit payloads over named `window.eppAPI` channels (see `fs.saveProject(project, options)` for the existing precedent of a full project object crossing the IPC boundary).
- `print-preview` already solved "render a page exactly as it will print, at print resolution, with no editor gizmos" for the *active page* in the *main window* — but that solution (`PreviewStage.tsx`, DOM + CSS) only matters for on-screen preview. It does not need to be reused for PDF/print output, because the codebase already carries a parallel, DOM-free toolkit for the same placement math:
  - `packages/layout-engine/src/imageFit.ts`: `computeFitInParent`, `computeSpecificSize`, `computeStretch`, `computeEnvelopeCrop`, `orientBoxMm` — pure functions computing exactly where/how large a placed image renders for each scaling rule, and (for `envelopeParent`/"cover") the exact source-pixel crop rectangle needed. All already unit-tested, all already used by the DOM path.
  - `src/lib/imageDisplay.ts`: `computeImageRenderRectMm` (pre-rotation render size) and `computeImageDisplayRectMm` (final post-rotation bounding box, centered within its slot/element box) build on the above.
  - `src/lib/units.ts`: `mmToPt` and `domainToPdfCoords` (mm → PDF point conversion, including the top-left/bottom-left Y-axis flip PDF needs) — written and unit-tested, but not called from anywhere yet.
  - `electron.vite.config.ts` already aliases `@epp/layout-engine` for the **Main** process build, not just the renderer — the layout engine's pure math is already meant to run in Main.
  This is a complete, already-tested toolkit for composing a PDF page directly, with no browser rendering pass at all. `src/lib/units.ts`/`imageDisplay.ts` have no DOM dependency either (pure TS, only importing from `@epp/layout-engine`), so Main can import them directly by relative path even though they live under `src/lib/`.
- `EPPProjectPage.pageConfig` (size preset/custom size, orientation, DPI) is per-page, not per-project — pages in one project can have different physical sizes.
- Main already decodes images via `nativeImage` (`electron/main/ipc/fs.handlers.ts`/`fs.helpers.ts`): `nativeImage.createFromPath`, `.resize()`, and the existing `computeCoverDecodeSize(nativeWidthPx, nativeHeightPx, minWidthPx, minHeightPx)` helper (the same one backing `images:decode-at-size`, which print-preview's `usePrintResolutionSrc` already calls). `nativeImage` also supports `.crop({x, y, width, height})` and `.toJPEG(quality)`, giving raw bytes without a data-URL round trip.
- `pdf-lib` can create a `PDFDocument` whose pages each have an independently-set size (`doc.addPage([widthPt, heightPt])`) and can embed JPEG/PNG bytes directly (`embedJpg`/`embedPng`), drawing them via `page.drawImage({ x, y, width, height, rotate })` at an arbitrary position, size, and rotation.
- `pdf.handlers.ts`/`print.handlers.ts` are already stubbed with the right channel names (`pdf:export`, `print:document`) and already throw instead of silently no-op-ing.

**Revision note**: an earlier version of this design used a hidden `BrowserWindow` re-rendering pages as HTML/CSS and driving `webContents.printToPDF`/`webContents.print`, with CSS Paged Media (`@page`) rules to handle mixed page sizes. That approach is abandoned in favor of the direct-composition approach below, once it became clear mid-implementation that the pure geometry helpers above already exist, are already tested, and make direct PDF composition both simpler and more reliable than re-deriving page layout through a second DOM render pass.

## Goals / Non-Goals

**Goals:**
- Produce PDF/print output whose placement geometry matches print-preview's, by reusing the exact same pure fit/crop/rotation math print-preview's DOM rendering is built on (`computeImageRenderRectMm`, `computeEnvelopeCrop`, `resolveLayout`) — even though the final draw call (pdf-lib vs. DOM/CSS) is necessarily different, so it's not literally "no second implementation," but it is the same math down to the same tested functions.
- Keep Main process stateless with respect to document data, consistent with the existing `electron-shell` pattern.
- Support per-page size/orientation/DPI in PDF export, since the data model already allows it, and pdf-lib supports it natively (no merge step required).
- Send every page of the project in one action for both Export PDF and Print — neither one scopes to just the page currently shown in preview.

**Non-Goals:**
- Guaranteeing physical per-page size fidelity when a *printer/driver* doesn't honor a multi-page PDF's own per-page sizes during a live print job — Print loads an actual composed PDF into Chromium's built-in PDF viewer and prints that, which is the same mechanism (and the same reliability) as printing any PDF from Chrome; whatever the OS/driver does with a mixed-size PDF is outside this app's control. (Export PDF itself has no such caveat — pdf-lib pages keep their own exact size regardless of any printer.)
- Print job configuration UI (paper tray, color, duplex, quality) beyond what the native OS print dialog already provides.
- Any new file format besides PDF for export.

## Decisions

### 1. Compose the PDF directly in Main with `pdf-lib` — no hidden renderer window, no second React tree

A new pure-ish module (Main-side, e.g. `electron/main/pdf/composeProjectPdf.ts`) builds a `PDFDocument` from an `EPPProject`: for each page, `doc.addPage([widthPt, heightPt])` sized from that page's `pageConfig` (via `mmToPt`, honoring orientation), then for every placed image — every `imageSlot` with an assignment and every `freeformElement` — on that page:

1. Resolve the slot/element's absolute box via `resolveLayout` (imageSlot) or the freeform element's own `transform` plus its parent `freeformCanvas`'s padding offset (freeform) — the same box each DOM path already computes.
2. Compute the pre-rotation render size with `computeImageRenderRectMm(asset, box, scalingRule, specificSizeMm, discreteRotation)` — `discreteRotation` is `imageSlotConfig.imageRotationDeg` for an `imageSlot`, `undefined` for a freeform element (its rotation is applied afterward as a whole-box rotation, exactly mirroring how `SlotImage`/`PreviewFreeformImage` split the two rotation concepts today).
3. If `scalingRule === 'envelopeParent'`, compute the source crop rectangle with `computeEnvelopeCrop(asset, renderRect.widthMm / renderRect.heightMm)` and crop the decoded bitmap to it before scaling (this replaces what CSS `object-fit: cover` did for free in the DOM path). `stretch` draws the full source scaled to fill `renderRect` with no crop (matching `object-fit: fill`'s intentional distortion). `fitInParent`/`specificSize` draw the full source scaled to fill `renderRect` with no crop (the DOM path never crops for these — `renderRect` already preserves source aspect via `contain`).
4. Decode the source at print resolution via `nativeImage` + the existing `computeCoverDecodeSize`, targeting `renderRect`'s size in pixels at the page's configured DPI (same target `usePrintResolutionSrc` already computes for preview), then `.crop()` if step 3 needs it, then `.toJPEG(92)` for embeddable bytes.
5. Embed the JPEG (`pdfDoc.embedJpg`) and draw it (`page.drawImage`) at the point/rotation a new pure placement helper computes (see decision 4) — the image's box is always centered on the slot/element box's own center (true for every scaling rule, per `computeImageDisplayRectMm`'s own contract), rotated by the discrete `imageSlotConfig.imageRotationDeg` (imageSlot) or the continuous `element.transform.rotationDeg` (freeform) around that same center point.

An unassigned slot, or one whose asset is `missing`, is simply skipped — the page's own white background already satisfies "renders blank" (no separate blank-drawing step needed).

**Alternative considered (original design)**: hidden `BrowserWindow` + `webContents.printToPDF` per page, CSS `@page` sizing, `pdf-lib` used only to merge already-rendered single-page PDFs. Rejected once the existing pure geometry helpers (decision context above) made direct composition both less code and less fragile — no second renderer entry point, no dependency on Chromium's CSS Paged Media page-name feature, no per-page `printToPDF` + merge round trip.

**Alternative considered**: keep using the DOM (`SlotImage`) for pixel-perfect rendering fidelity by rasterizing each page as a screenshot (`webContents.capturePage`) and embedding that as one full-page image per PDF page. Rejected — a full-page raster embed is much larger, blurrier at high DPI, and loses the crisp per-image JPEG embedding a "real" PDF has (worse for the exact use case, high-fidelity photo printing).

### 2. `pdf:export` writes the composed document directly — no merge step

`dialog.showSaveDialog` (default filename from the project name, `.pdf` filter) → if not cancelled, `composeProjectPdf(project)` → `pdfDoc.save()` → `fs.writeFile`. Because `pdf-lib` builds one `PDFDocument` with N independently-sized pages from the start, there is nothing to merge.

### 3. `print:document` reuses the same composed PDF via Chromium's built-in PDF viewer

Same `composeProjectPdf(project)` call, `pdfDoc.save()` to bytes, written to a temp file (`app.getPath('temp')`). A single, lazily-created, reused hidden `BrowserWindow` (`show: false`, `webPreferences: { plugins: true }` — required for Electron's built-in Chrome PDF Viewer to render a navigated `.pdf` URL) loads that temp file (`loadURL('file://' + tempPath)`), and once its content finishes loading, Main calls `webContents.print()` once against it. This prints an actual multi-page PDF — the same mechanism (and reliability) Chrome itself uses to print a PDF with mixed page sizes, not a custom rendering path. The temp file is deleted once the print callback fires (or the operation otherwise settles).

No `?renderMode=print` renderer entry point, no `<PrintDocument/>` React tree, and no `print:render-project`/`print:render-ready` IPC handshake are needed — the hidden window's only job is displaying a PDF Chromium already knows how to paginate and print, and "ready" is just the window's own `did-finish-load` event.

### 4. A hand-rolled placement/rotation helper converts domain-space (mm, Y-down) boxes to `pdf-lib` draw parameters

`pdf-lib`'s `page.drawImage({ x, y, rotate })` rotates the image around the `(x, y)` anchor (its own pre-rotation corner), not around its center, and PDF space is Y-up while our domain space is Y-down (top-left origin) — two mismatches the DOM path never had to deal with (the browser's `transform-origin: center` and CSS's Y-down convention made it free). A new pure helper takes the box's absolute center in domain space, the pre-rotation render size, and the rotation angle (continuous, degrees, clockwise-positive to match the existing CSS convention), and returns the `x`/`y`/`rotate` `pdf-lib` needs so the rotated image's visual center lands at the same point, rotating the same visual direction as the DOM path does today.

Since `imageSlotConfig.imageRotationDeg` is a discrete `0 | 90 | 180 | 270` but `FreeformTransform.rotationDeg` is a continuous `number`, the helper is written once for the general (continuous) case — the discrete case is just that function called with one of four fixed values, not a separate code path.

### 5. Export destination and file write stay in Main, mirroring `fs.saveProject`

Unchanged from the original design: `pdf:export`'s handler owns the save dialog and the file write, returning the saved path or `null` on cancel — this replaces the current preload stub's `Promise<Uint8Array>` return type, which implied the renderer would own the save step; it can't, since the renderer has no filesystem access (`electron-shell`'s sandboxing requirement). Mirrors `fs.saveProject(project, options): Promise<string | null>` exactly.

## Risks / Trade-offs

- [Hand-rolled rotation/placement math (decision 4) must exactly match what the DOM path renders visually, and it's easy to get the anchor point or the Y-axis flip backwards] → Dedicated unit tests for the placement helper covering 0°, 90°, and at least one non-axis-aligned angle, asserting against manually-derived expected coordinates (not just "it runs without throwing"); a manual side-by-side check (a page with a rotated image, compared between print-preview's on-screen rendering and the exported PDF) as part of task 6's verification.
- [Each scaling rule (`envelopeParent`/`stretch`/`fitInParent`/`specificSize`) needs its own crop-or-not handling in Main, where the DOM got `object-fit` for free] → Mitigated by reusing the existing, already-tested `computeEnvelopeCrop`/`computeFitInParent`/`computeSpecificSize`/`computeStretch` functions from `@epp/layout-engine` rather than re-deriving the fit math — only "turn that into an actual cropped bitmap + draw call" is new.
- [Electron's built-in PDF viewer requires `webPreferences: { plugins: true }`; easy to omit and get a blank/broken print] → Called out explicitly in decision 3; verified as part of manual testing (task 6.2).
- [A hidden `BrowserWindow` still has memory/startup cost, now used only for printing] → Created lazily on first print, reused across calls within a session, same as the original design's mitigation.
- [A print/export left running while the user closes the app] → Main tears down the hidden window, deletes any in-flight temp PDF file, and rejects any in-flight `pdf:export`/`print:document` promise on `before-quit`.
- [Embedding many high-resolution images as JPEG could make `pdf-lib`'s `save()` slow, or produce a large file, for a project with many pages] → Acceptable at this app's scale (a handful of pages per project); JPEG (not PNG) keeps embedded size reasonable for photographic content, matching the print use case. Revisit only if real usage shows it's a problem.
