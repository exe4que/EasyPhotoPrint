## 1. Capacitor scaffolding

- [x] 1.1 Add `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/preferences` to `package.json`.
- [x] 1.2 Create `capacitor.config.ts` at the repo root (app id, app name, `webDir` pointing at the new mobile build's output directory).
- [x] 1.3 Run `npx cap add android` to generate the `android/` Gradle project.
- [x] 1.4 Confirm `android/` builds with an empty/default webview (`./gradlew assembleDebug` succeeds) before adding any app-specific code, to isolate toolchain problems from app problems.

## 2. Mobile build target and entry point

- [x] 2.1 Add a mobile Vite build config (or a second target in the existing Vite setup) that produces a plain static bundle (no Electron-specific output layout) into the directory `capacitor.config.ts`'s `webDir` points at.
- [x] 2.2 Add `src/main.android.tsx`, mirroring `src/main.tsx`, that calls `registerPlatformAdapter(createAndroidAdapter())` before rendering `App`.
- [x] 2.3 Add an `index.html` (or reuse/parameterize the existing one) for the mobile build pointing at the new entry point.
- [x] 2.4 Add a `build:android` script to `package.json` that runs the mobile Vite build followed by `npx cap sync android`.
- [x] 2.5 Verify `npm run build:android` succeeds and produces a bundle Capacitor picks up (`npx cap sync android` reports no errors).

## 3. Android adapter skeleton and settings

- [x] 3.1 Create `src/lib/platform/androidAdapter.ts` exporting `createAndroidAdapter(): EppAPI`, initially with every member implemented (throwing a clear "not wired yet" error is not acceptable per the contract's totality requirement — stub only what section 4+ hasn't reached yet, and track that explicitly in this checklist rather than leaving TODOs in code).
- [x] 3.2 Implement `settings.get`/`settings.set` using `@capacitor/preferences`, matching `AppSettings`'s shape exactly.
- [x] 3.3 Implement all eight `menu.*` subscriptions as no-ops returning a working (no-op) unsubscribe function.
- [x] 3.4 Unit test `androidAdapter.ts`'s settings methods and menu no-ops the same way `electronAdapter.test.ts` covers the Electron adapter (register a fake `Preferences` plugin implementation).

## 4. Custom SAF-backed Capacitor plugin (file access)

- [x] 4.1 Scaffold a custom Capacitor plugin project (Kotlin) under `android/app/src/main/` for SAF-backed file access — e.g. `SafFilePlugin`.
- [x] 4.2 Implement an `openImages` plugin method: launches `ACTION_OPEN_DOCUMENT` with multi-select and an image MIME filter, returns the list of picked `content://` URIs (as strings) plus each file's bytes (base64) to the TS side.
- [x] 4.3 Implement an `openDocument` plugin method (single-select, MIME/extension filtered) for `fs.openProject` and `dialog.relinkImage`'s picker.
- [x] 4.4 Implement a `createDocument` plugin method wrapping `ACTION_CREATE_DOCUMENT` for `fs.saveProject`'s first-save/"Save As" path, and a `writeDocument` method that writes bytes to an already-known `content://` URI via `ContentResolver.openOutputStream` for subsequent plain saves.
- [x] 4.5 Register the plugin in the Android project (`MainActivity`'s plugin list) and confirm it's callable from TS via `registerPlugin`/the generated TS binding.

## 5. In-WebView working storage, image decode, and PDF composition

- [x] 5.1 Add a renderer-side working-storage module (e.g. `src/lib/android/workingStorage.ts`) backed by IndexedDB: put/get/remove/clear a `Blob` keyed by `assetId` — the Android counterpart to Electron's working directory (see design.md, Decision 3a).
- [x] 5.2 Add a renderer-side module (e.g. `src/lib/android/imageDecode.ts`) that decodes an image (from a `Blob`) via `createImageBitmap`, and exposes resize/crop/encode operations via `OffscreenCanvas`, shaped closely enough to `electron/main/imageDecoder.ts`'s `DecodedImage` to keep the two implementations easy to compare even though they aren't shared (see design.md, Decision 4 / Non-Goals).
- [x] 5.3 Port `fs.handlers.ts`/`fs.helpers.ts`'s pure `computeThumbnailSize`/`computeCoverDecodeSize` logic into a renderer-side module (new file — not a cross-boundary import from `electron/main/`) for use by ingest thumbnailing and `images.decodeAtSize` on Android.
- [x] 5.4 Add a renderer-side PDF composition module (e.g. `src/lib/android/composeProjectPdf.ts`) that calls `composeProjectPdf.helpers.ts`'s `computePagePlacements` and `pdfPlacement.ts`'s placement math, using `pdf-lib` and the new image-decode module from 5.2 in place of `nativeImage`.
- [x] 5.5 Unit test the new pure ports from 5.3 against the same cases `fs.helpers.test.ts` already covers, confirming identical output to the Electron originals.

## 6. Custom print plugin

- [x] 6.1 Scaffold a second custom Capacitor plugin (Kotlin) — e.g. `PrintPlugin` — with a `printPdf` method taking base64 PDF bytes.
- [x] 6.2 Implement `printPdf` to write the bytes to a temp file and invoke `PrintManager.print(...)` with a `PrintDocumentAdapter` that streams that file, opening Android's native print dialog.
- [x] 6.3 Register the plugin and confirm it's callable from TS.

## 7. Wire the remaining adapter members

- [x] 7.1 Implement `dialog.openImages`: call the SAF plugin's `openImages`, then for each picked file, store its bytes in IndexedDB working storage (5.1) under a fresh `assetId`, decode dimensions and generate a thumbnail via the modules from 5.2/5.3, and return a fully-formed `ImageAsset[]` with `storedPath` set to that `assetId` — the Android counterpart to `fs.handlers.ts`'s `createImageAssetFromPath`.
- [x] 7.2 Implement `dialog.relinkImage` using the SAF plugin's `openDocument`, following the same store/decode/thumbnail sequence as 7.1 for a single file.
- [x] 7.3 Implement `fs.openProject`: use the SAF plugin's `openDocument` filtered to `.eppproj`, unzip via `fflate` (already a portable dependency), store each bundled image's bytes in IndexedDB working storage under its persisted `assetId`, decode/thumbnail each via 5.2/5.3, and return `{ project, filePath }` with `filePath` set to the opaque `content://` URI string for the project file itself (each image's `storedPath` is set to its `assetId`, not a URI).
- [x] 7.4 Implement `fs.saveProject`: zip the project JSON plus every pool image's current bytes (read back from IndexedDB working storage via each asset's `storedPath`/`assetId`) via `fflate`, and write it via the SAF plugin's `createDocument` (first save / Save As) or `writeDocument` (subsequent saves to an already-known URI), returning the URI string.
- [x] 7.5 Implement `fs.resetWorkingStorage`: clear the IndexedDB working-storage object store.
- [x] 7.6 Implement `images.decodeAtSize` using the modules from 5.2/5.3 against the `Blob` read back from IndexedDB working storage for the requested asset.
- [x] 7.7 Implement `pdf.export`: run the composition module from 5.4, then hand the resulting bytes to the SAF plugin's `createDocument` to let the user choose a save location, returning the URI string or `null` if canceled.
- [x] 7.8 Implement `print.document`: run the same composition module from 5.4, then pass the resulting bytes to the print plugin's `printPdf`.
- [x] 7.9 Implement `templates.list`/`save`/`delete` using the app's private storage (e.g. `@capacitor/preferences` or a private-directory JSON file per template) — templates carry no image references (per `packaged-project-files`'s proposal), so no SAF/content-URI involvement is needed here.

## 8. Build, install, and run

- [ ] 8.1 Build an AVD (or confirm a physical device is available) for manual verification.
- [ ] 8.2 Run `npm run build:android` and `npx cap open android` (or `./gradlew installDebug`) to build and install the app.
- [ ] 8.3 Launch the app and confirm the renderer boots (same UI as desktop, no console errors from a missing adapter).

## 9. End-to-end verification (manual, on emulator/device)

- [ ] 9.1 Load images via "Load images": confirm the native picker opens, selected images appear in the Image Library with correct thumbnails.
- [ ] 9.2 Assign an image to a slot (tap-to-assign, per `pointer-based-gestures`) and confirm it renders correctly in the page preview.
- [ ] 9.3 Change the unit toggle, fully close and relaunch the app, confirm the preference persisted.
- [ ] 9.4 Export PDF: confirm the native "create document" picker opens, the resulting file is a valid multi-page PDF with correctly placed/cropped/resized images.
- [ ] 9.5 Print: confirm Android's native print dialog opens with the same content as the exported PDF.
- [ ] 9.6 Save a project, fully close and relaunch the app, open that project via "Open project", confirm all pages/images/layout restore correctly.
- [ ] 9.7 Confirm no shared component under `src/components`, `src/store`, `src/hooks`, or `src/lib` (other than the new Android-specific modules) needed any changes to make the above work.

## 10. Spec closure

- [ ] 10.1 Run the full test suite and typecheck (desktop build must remain unaffected).
- [ ] 10.2 Run `openspec validate --strict --changes android-shell` and confirm it passes.
