## Why

The print-preview screen already shows "Export PDF" and "Print" controls (`print-preview` capability), and the Main process already stubs `pdf:export`/`print:document` IPC channels that both throw `"not implemented yet"` (`electron/main/ipc/pdf.handlers.ts`, `print.handlers.ts`). Easy Photo Print has no way to actually produce output from a laid-out project: this change wires those controls to real PDF generation and native printing so a finished layout can leave the app as a file or a printed sheet.

## What Changes

- Implement `pdf:export`: composes every page of the current project directly into a PDF (`pdf-lib`, in the Main process) at its own configured size/orientation, placing every image at print resolution using the same pure fit/crop/rotation math print-preview's on-screen rendering already uses (`computeImageRenderRectMm`, `computeEnvelopeCrop`, `resolveLayout`), prompts the user for a destination file via a native save dialog, and writes it.
- Implement `print:document`: composes the same multi-page PDF, then hands it to Chromium's built-in PDF viewer in a hidden window and opens a single native OS print dialog against it — the same mechanism (and reliability) Chrome itself uses to print any PDF, mixed page sizes included.
- Wire the "Export PDF" and "Print" buttons in `PreviewScreen.tsx` to these two IPC calls, with basic in-progress/error feedback (buttons disable while the corresponding job is running; failures surface as an inline message instead of failing silently).
- Add `pdf-lib` as a new production dependency, used only in the Main process, to build the PDF page-by-page (each page created at its own physical size — no merge step needed, since a single `PDFDocument` can hold independently-sized pages from the start).
- Add a hidden, off-screen `BrowserWindow` used only by the print flow, to host Chromium's built-in PDF viewer long enough to print the composed document — it does not run any of this app's own renderer code, only the composed PDF file.

**Caveat worth flagging**: both "Export PDF" and "Print" now send every page of the project. Export preserves each page's own configured size exactly, since a PDF page can be any size. Print sends everything through a single native print job — if pages have different physical sizes, whether the printer/driver honors each page's own size, versus the paper size the user picks in the OS print dialog, is best-effort, the same limitation any application has printing a mixed-size document.

## Capabilities

### New Capabilities
- `pdf-export`: what happens when "Export PDF" is activated — page-accurate multi-page PDF generation (size/orientation/DPI/rotation preserved per page, full-resolution images, empty slots rendered blank same as preview), destination file picking, and failure handling.
- `printing`: what happens when "Print" is activated — print-resolution rendering of every page, in order, handed to a single native OS print dialog, and failure handling.

### Modified Capabilities
- `print-preview`: the existing requirement stating the "Export PDF"/"Print" controls are visible but inert ("activating either control does not export, print, or otherwise change the application state") changes to describe them as wired to the `pdf-export`/`printing` capabilities, including the disabled/busy state while a job runs.

## Impact

- `electron/main/ipc/pdf.handlers.ts`, `electron/main/ipc/print.handlers.ts` — real implementations replacing the throwing stubs.
- New `electron/main/pdf/composeProjectPdf.ts` (or similar) — the shared PDF-composition module both handlers call.
- New `electron/main/print-render/` module — lifecycle of the hidden `BrowserWindow` used to host Chromium's PDF viewer for printing.
- `electron/preload/index.ts` — `eppAPI.pdf.export`/`eppAPI.print.document` payload/return types made concrete (export currently declares a `Uint8Array` return that no longer matches a Main-owned save-dialog flow; it becomes the saved path or `null` on cancel, mirroring `fs.saveProject`).
- New pure geometry helper(s) (alongside `src/lib/units.ts`) converting a domain-space box + rotation into `pdf-lib` draw parameters, reusing `computeImageRenderRectMm`/`computeEnvelopeCrop`/`domainToPdfCoords`/`mmToPt` (all already in the codebase, mostly unused until now).
- `src/components/preview/PreviewScreen.tsx` — button wiring, busy/error UI. (`PreviewStage.tsx` itself is unaffected — PDF/print output no longer goes through any DOM rendering path.)
- `package.json` — new dependency `pdf-lib`.
