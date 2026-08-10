## Why

Images visibly lose quality once assigned to a slot, most noticeably in the print-preview screen — the exact place a user checks a page is ready to print. This was reported against `test/TestPreview.eppproj`, a real project with several large source photos (up to 5120×2880px) mixed with a couple of small ones. Investigation confirmed the cause: `ImageAsset.thumbnailDataUrl` — the *only* bitmap ever loaded into the renderer for any purpose — is deliberately capped at a 240px longer edge by the already-archived `project-persistence` capability's "Thumbnail is downscaled to a bounded edge" requirement. That cap is correct for its documented purpose (a lightweight Image Library card thumbnail), but the editor canvas and the print-preview screen both reuse that same 240px asset as their only image source too, since no other resolution was ever built. A 240px source stretched across a large on-screen slot is what the user is seeing as "quality loss" — not a rendering bug, but a genuine resolution gap with no separate code path to fix it.

Per the user's explicit scope, this change fixes it for print-preview only, computing and loading each placed image at its actual print-target resolution (the slot's resolved size in mm, at the page's configured DPI) instead of the 240px thumbnail. The editor canvas keeps using the thumbnail unchanged — same known gap, explicitly out of scope here.

## What Changes

- Add a new `images.decodeAtSize(filePath, minWidthPx, minHeightPx)` method on `window.eppAPI`, backed by a new `images:decode-at-size` IPC channel: given a file path and a minimum required size, Main decodes the source file and returns it scaled down only as far as needed to still cover that minimum in both dimensions (preserving the source's native aspect ratio, never upscaling past the source's own resolution).
- The print-preview screen computes, for every placed image (grid/flex `imageSlot` or `freeformCanvas` element), the pixel size that image will actually occupy at the page's configured DPI, requests a decode at that size, and displays the result once ready — showing the existing low-resolution thumbnail immediately in the meantime so preview isn't blocked waiting on decode time.
- Decoded results are cached in memory per (file, target size) for the app session, so repeated visits to preview or navigating between pages don't redundantly re-decode the same image.

## Capabilities

### Modified Capabilities
- `electron-shell`: the "Explicit contextBridge API surface" requirement's enumerated `window.eppAPI` namespaces gains `images`, backing the new decode-at-size channel.
- `print-preview`: the "Full-Screen Faithful Rendering" requirement is extended — placed images render at their print-target resolution (computed from resolved size × page DPI), not the Image Library's 240px thumbnail.

## Impact

- `electron/main/ipc/fs.handlers.ts`: new `decodeImageAtSize` (Electron/`nativeImage`-dependent) alongside the existing `decodeAndThumbnail`; new `images:decode-at-size` handler registered in `registerFsHandlers()`.
- `electron/main/ipc/fs.helpers.ts`: new pure, testable sizing helper (mirrors the existing `computeThumbnailSize`, inverted: "smallest size that still covers this minimum" instead of "largest size that stays under this maximum").
- `electron/preload/index.ts`, `src/lib/ipc-client.ts`: new `images.decodeAtSize` surface.
- `src/components/canvas/SlotImage.tsx`: gains an optional prop to display a caller-supplied high-resolution source in place of `asset.thumbnailDataUrl`; editor callers (`PageStage.tsx`, `FreeformElement.tsx`) are unaffected and keep omitting it.
- `src/components/preview/PreviewStage.tsx`: its inline per-image JSX (both the `imageSlot` loop and the `freeformCanvas` element loop) becomes small named components so each can use a new hook that requests/caches the print-resolution decode and falls back to the thumbnail while it's pending.
- No change to `SlotImage`'s geometry math, `computeImageRenderRectMm`/`computeImageDisplayRectMm`, or how the editor canvas renders images.
