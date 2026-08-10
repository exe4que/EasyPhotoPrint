## 1. Decoder contract and Electron implementation

- [x] 1.1 Created `electron/main/imageDecoder.ts`: `DecodedImage` interface (`getSize`, `resize`, `crop`, `toDataURL`, `toJPEG`) and `ImageDecoder` interface (`decodeFromPath(filePath: string): Promise<DecodedImage>`).
- [x] 1.2 `createElectronImageDecoder(): ImageDecoder` in the same file — `decodeFromPath` returns `nativeImage.createFromPath(filePath)` directly (a pass-through).

## 2. Wire fs.handlers.ts through the contract

- [x] 2.1 In `electron/main/ipc/fs.handlers.ts`, replaced the `nativeImage` import with `createElectronImageDecoder` and a module-level `const decoder = createElectronImageDecoder();`.
- [x] 2.2 `decodeAndThumbnail(filePath)` is now async, using `await decoder.decodeFromPath(filePath)`; `getSize`/`resize`/`toDataURL` unchanged.
- [x] 2.3 `decodeImageAtSize(...)` is now async the same way; its call site in `DECODE_IMAGE_AT_SIZE_CHANNEL` awaits it.
- [x] 2.4 `createImageAssetFromPath` awaits its now-async call to `decodeAndThumbnail`.
- [x] 2.5 `regenerateImageAsset(persisted, imagesDir)` is now async; its call site in `OPEN_PROJECT_CHANNEL` is `await Promise.all(imagePool.map((asset) => regenerateImageAsset(asset, imagesDir)))`.

## 3. Wire composeProjectPdf.ts through the contract

- [x] 3.1 In `electron/main/pdf/composeProjectPdf.ts`, replaced the `nativeImage` import with `createElectronImageDecoder` and a module-level `const decoder = createElectronImageDecoder();`.
- [x] 3.2 `embedPlacedImage` now awaits `decoder.decodeFromPath(spec.asset.storedPath)`; `getSize`/`crop`/`resize`/`toJPEG` unchanged.

## 4. Verification

- [x] 4.1 Ran the full test suite and typecheck — 177/177 passing, no new automated tests.
- [x] 4.2 Confirmed the seam holds: `nativeImage` is imported from `electron` in exactly one Main-process file (`imageDecoder.ts`) — `fs.handlers.ts` and `composeProjectPdf.ts` no longer import it at all (the two doc-comment mentions of "nativeImage" left in `fs.helpers.ts`/`composeProjectPdf.helpers.ts` are prose describing what those *pure* helper files deliberately don't depend on, not imports).
- [x] 4.3 Verify end-to-end in the running Electron app that output is unchanged: load an image (thumbnail renders correctly), print-resolution preview still decodes correctly, Export PDF still produces a valid multi-page PDF with correctly placed/cropped/resized images, and opening a previously saved `.eppproj` still re-extracts and re-thumbnails its images correctly (exercises the now-async `regenerateImageAsset`).
- [x] 4.4 Run `openspec validate --strict --changes portable-pdf-pipeline` and confirm it passes.
