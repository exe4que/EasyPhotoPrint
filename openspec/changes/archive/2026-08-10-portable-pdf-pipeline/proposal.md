## Why

`electron/main/pdf/composeProjectPdf.ts` and `electron/main/ipc/fs.handlers.ts` both import `nativeImage` from `electron` directly to decode, resize, crop, and encode image bytes — for PDF composition, ingest thumbnails, and print-resolution preview. `nativeImage` is Electron-only; it doesn't exist in a Capacitor/Android WebView. Everything else these two files do is already portable: `pdf-lib` (PDF composition) and the pure geometry/placement math in `composeProjectPdf.helpers.ts`/`src/lib/pdfPlacement.ts` run identically in Node or a browser. `nativeImage` is the single remaining Electron-specific dependency standing between "this logic only runs in Electron's Main process" and "this logic could run anywhere a JS engine can decode images" — which, notably, includes the WebView itself via `createImageBitmap`/`OffscreenCanvas`, meaning a future Android implementation may not need a native plugin for PDF export at all.

This is the fourth of the desktop-verifiable phases toward running the same renderer on Android (after `extract-platform-adapter`, `packaged-project-files`, `pointer-based-gestures`). Like the first of those, this change is a "prove it now, benefit later" step: Electron's decoder implementation is a behavior-preserving pass-through, so PDF/thumbnail/preview output is byte-for-byte identical to before — the payoff is that nothing outside one small adapter file needs to change when an Android decoder eventually exists.

## What Changes

- New `ImageDecoder`/`DecodedImage` contract (interfaces only, no new package) capturing the exact six operations these two files actually use today: decode-from-path, `getSize`, `resize`, `crop`, `toDataURL`, `toJPEG`. `composeProjectPdf.ts` and `fs.handlers.ts` stop importing `nativeImage` directly and call this contract instead.
- One Electron implementation (`createElectronImageDecoder`), a pass-through exactly like `extract-platform-adapter`'s Electron adapter: `decodeFromPath` returns Electron's own `NativeImage` object directly (it already satisfies the `DecodedImage` shape), so there's no re-encoding, no added indirection, and no behavior change. Only this one file imports `nativeImage` from `electron`.
- `decodeFromPath` is async (reading and decoding a file is the genuinely platform-variable, I/O-bound step); the manipulation methods on an already-decoded `DecodedImage` (`resize`, `crop`, `getSize`, `toDataURL`, `toJPEG`) stay synchronous, matching `nativeImage`'s own actual shape — no point inventing async signatures for operations that are synchronous on every implementation this change actually has to satisfy. `fs.handlers.ts`'s `regenerateImageAsset` becomes async as a direct, mechanical consequence (its one caller already maps over an array inside an async handler).
- No registry/adapter-selection ceremony like `platform-adapter`'s `registerPlatformAdapter`. Unlike the renderer (one bundle that must pick an implementation at runtime depending on its host), `electron/main/**` is unambiguously Electron-only forever — there is no scenario where the same Main-process bundle runs under a different host. Each call site constructs `createElectronImageDecoder()` directly; the seam exists so a *different* file in a *different* deployment target can construct a *different* implementation later, not so this file picks between them.
- Explicitly out of scope: no Android/Capacitor decoder implementation, no relocation of `composeProjectPdf.ts` out of `electron/main/pdf/` into a shared package, no change to any IPC channel, PDF output, thumbnail, or print-preview behavior. Verifiable entirely on desktop.

## Capabilities

### New Capabilities

- `image-decoding`: the single contract Main-process code uses to decode, resize, crop, and encode image bytes, so PDF composition and image-ingest/preview code never hardcodes a host-specific image API directly.

### Modified Capabilities

(none — `pdf-export` and `printing`'s requirement text describes user-facing PDF/print behavior, not an implementation mechanism, and neither mentions `nativeImage`; this change produces byte-for-byte identical output, so nothing in either capability's requirements changes)

## Impact

- New: `electron/main/imageDecoder.ts` — `ImageDecoder`/`DecodedImage` interfaces and `createElectronImageDecoder()`.
- `electron/main/pdf/composeProjectPdf.ts`: `embedPlacedImage` decodes/crops/resizes/encodes through the decoder contract instead of `nativeImage` directly.
- `electron/main/ipc/fs.handlers.ts`: `decodeAndThumbnail` and `decodeImageAtSize` go through the decoder contract; `regenerateImageAsset` becomes async (mechanical ripple from `decodeAndThumbnail` awaiting `decodeFromPath`), and its one call site (mapping `imagePool` inside `OPEN_PROJECT_CHANNEL`) becomes `Promise.all(...)`.
- No changes to `composeProjectPdf.helpers.ts` (already has no `nativeImage`/`pdf-lib` dependency), `fs.helpers.ts` (`computeCoverDecodeSize` is already pure), any IPC channel signature, `src/lib/**`, the renderer, or `platform-adapter`.
- No new automated tests: this exact area (Main-process pixel decoding, PDF composition) has no unit-test coverage today either — `composeProjectPdf.ts` itself isn't unit tested (only its pure helpers in `composeProjectPdf.helpers.ts` are), and `fs.handlers.ts` has no test file at all, for the same reason (`nativeImage` isn't meaningfully mockable outside a real Electron runtime). Verification is the established Export PDF / Load Images / print-resolution-preview checks in the manual Electron E2E recipe, which already exercise this exact code path end-to-end.
