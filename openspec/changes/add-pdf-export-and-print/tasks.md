## 1. Dependencies and placement/rotation geometry

- [x] 1.1 Add `pdf-lib` to `package.json` (Main-only usage; do not import it from renderer code).
- [x] 1.2 Add `mmToPt`/`domainToPdfCoords`-adjacent pure helper(s) for converting a domain-space (mm, Y-down, top-left origin) box's absolute center + pre-rotation size + rotation angle (continuous degrees, clockwise-positive) into the `x`/`y`/`rotate` `pdf-lib`'s `page.drawImage` needs, accounting for `pdf-lib` rotating around its own anchor corner rather than the box's center, and for PDF's Y-up axis. Put it alongside `src/lib/units.ts` (or a new `src/lib/pdfPlacement.ts`) so it can be unit-tested with the same tooling as `computeImageRenderRectMm`.
- [x] 1.3 Unit test that helper directly: 0°, 90°, and at least one non-axis-aligned angle, asserting against manually-derived expected coordinates (this is the highest-risk new math in this change — see design.md Risks).

## 2. PDF page composition

- [x] 2.1 Create `electron/main/pdf/composeProjectPdf.ts`: given an `EPPProject`, build a `pdf-lib` `PDFDocument` with one page per project page, each sized via `mmToPt` from that page's `pageConfig` (honoring orientation).
- [x] 2.2 For each `imageSlot` with an assigned, non-missing asset: resolve its absolute box via `resolveLayout`, compute the pre-rotation render size via `computeImageRenderRectMm` (passing `imageSlotConfig.imageRotationDeg` as the discrete rotation), and — for `envelopeParent` — the source crop rect via `computeEnvelopeCrop`.
- [x] 2.3 For each `freeformElement` with an assigned, non-missing asset: same as 2.2, using `resolveLayout`'s own `element.id`-keyed box (it already computes the element's absolute position from the canvas's box + `transform.xMm/yMm` directly — no manual padding-offset math needed), `computeImageRenderRectMm` called with `discreteRotation = undefined` (freeform's rotation is whole-box, applied in 2.5, not baked into the fit math), matching how `SlotImage`/`PreviewFreeformImage` split the two rotation concepts today.
- [x] 2.4 Decode the source image at print resolution: `nativeImage.createFromPath` + the existing `computeCoverDecodeSize` targeting the render rect's pixel size at the page's DPI, `.crop()` first when 2.2/2.3 computed a crop rect, then `.toJPEG(92)` for embeddable bytes. Reused the existing `computeCoverDecodeSize` export from `fs.helpers.ts` directly rather than duplicating it.
- [x] 2.5 Embed each JPEG (`pdfDoc.embedJpg`) and draw it (`page.drawImage`) using the placement helper from 1.2, rotated by `imageSlotConfig.imageRotationDeg ?? 0` (imageSlot) or `element.transform.rotationDeg` (freeform) around the slot/element box's own center.
- [x] 2.6 Leave unassigned slots and slots with a missing-asset assignment untouched (the page's own blank background already satisfies "renders blank" — no placeholder drawing).
- [x] 2.6b (added during implementation, not in the original plan) Clip each drawn image to its containing box before drawing it — per-slot for `imageSlot`, per-canvas (the padded content area, shared by all its elements) for `freeformCanvas` — via `pdf-lib`'s low-level `pushGraphicsState`/`clip`/`popGraphicsState` operators. This mirrors the `overflow-hidden` wrapper `PreviewStage.tsx` already uses; without it, an oversized `specificSize` image or a freeform element dragged past its canvas edge would bleed outside its box in the PDF/print output even though preview clips it.
- [x] 2.7 Unit tests for `composeProjectPdf`'s non-geometry logic where practical (e.g. page count/sizing matches `pages.length` and each page's `pageConfig`, slots with no assignment produce no draw calls) — full visual correctness is covered by 1.3's geometry tests plus manual verification (task 6.2), not by asserting on raw PDF bytes.

## 3. Main: PDF export

- [x] 3.1 Implement `pdf:export` in `electron/main/ipc/pdf.handlers.ts`: receive the project payload from the renderer, open a save dialog (`dialog.showSaveDialog`, default filename from the project name, `.pdf` filter); return `null` immediately without composing anything if cancelled.
- [x] 3.2 Call `composeProjectPdf(project)`, `pdfDoc.save()`, write the bytes to the chosen path, return the saved path.
- [x] 3.3 On any failure (a source image that fails to decode, a `pdf-lib` error, a file write error), reject the IPC call with a descriptive error instead of leaving the renderer waiting, and don't leave a partial file at the destination (only write after composition succeeds).

## 4. Main: print pipeline

- [x] 4.1 Implement `print:document` in `electron/main/ipc/print.handlers.ts`: receive the full project payload (all pages), call `composeProjectPdf(project)`, `pdfDoc.save()` to bytes, write to a temp file under `app.getPath('temp')`.
- [x] 4.2 Create the hidden-window module in Main (`electron/main/print-render/pdfPrintWindow.ts`): lazily creates a single reusable `BrowserWindow` (`show: false`, `webPreferences: { plugins: true, contextIsolation: true, nodeIntegration: false, sandbox: true }` — `plugins: true` is required for Electron's built-in PDF viewer), and tears it down on `app.on('before-quit')`.
- [x] 4.3 Load the temp PDF file into that window (`window.loadURL(pathToFileURL(...))`, whose own promise already resolves on `did-finish-load`/rejects on `did-fail-load` — no manual listeners needed, just a timeout race), then call `webContents.print()` once; resolve the IPC call once the print callback fires (whether printed or cancelled — both are non-error outcomes per the `printing` spec).
- [x] 4.4 Delete the temp PDF file once the print callback fires (or the operation otherwise settles, including on failure/timeout).
- [x] 4.5 On any failure preparing the document (composition error, load timeout, etc.) before the dialog opens, reject the IPC call with a descriptive error.

## 5. Preload and renderer wiring

- [x] 5.1 Update `electron/preload/index.ts`: change `pdf.export`'s return type from `Promise<Uint8Array>` to `Promise<string | null>` (saved path or `null` on cancel) and give `pdf.export`/`print.document`'s payload a concrete `EPPProject` type instead of `unknown`. Also updated the actual type contract renderer code sees (`EppAPI` in `src/lib/ipc-client.ts`), which the preload file's own inline `as Promise<...>` casts don't drive.
- [x] 5.2 Wire `PreviewScreen.tsx`'s "Export PDF" button to call `window.eppAPI.pdf.export(...)` with the current project (from the store): disable/show-busy on the button while in flight, show an inline success/error indication matching the `pdf-export` spec's failure-is-surfaced requirement. Added `exportPdf`/`printDocument` store actions (mirroring `saveProject`'s pattern) rather than building the `EPPProject` payload inline in the component — discovered and removed a pre-existing, unused, broken `exportPdf` action in `documentSlice.ts` (dead scaffold code from the original Fase 0-4 commit; hardcoded `imagePool: []`/fake project id, never wired to any button) that collided with the new one.
- [x] 5.3 Wire `PreviewScreen.tsx`'s "Print" button to call `window.eppAPI.print.document(...)` with the full project (all pages): same busy/error handling pattern as 5.2, matching the `printing` spec.
- [x] 5.4 Ensure both buttons independently guard against re-activation while their own action is in flight (per the `print-preview` MODIFIED requirement), without blocking the other control.

## 6. Tests and verification

- [x] 6.1 Add/extend unit tests for the new pure helper logic (placement/rotation from 1.3, `composeProjectPdf`'s structural checks from 2.7) alongside existing test patterns (`fs.helpers.test.ts`, `units.test.ts`).
- [ ] 6.2 Manually verify in the running Electron app: export a single-page project, export a multi-page project with pages of different sizes/orientations, print a single-page project, print a multi-page project and confirm every page reaches the native print dialog in order, cancel each dialog, confirm a forced failure (e.g. a page with a missing image asset) still exports/prints with a blank slot rather than erroring, and visually compare a page with a rotated/cropped image against what print-preview shows on screen for the same page.
- [ ] 6.3 Run `openspec validate --strict --all` before archiving.
