## Why

Four desktop-verifiable phases (`extract-platform-adapter`, `packaged-project-files`, `pointer-based-gestures`, `portable-pdf-pipeline`) have deliberately prepared the renderer to run on a second host without knowing it yet: every native capability goes through one `EppAPI` contract, `.eppproj` is a self-contained archive with no external path references, every canvas gesture is input-agnostic Pointer Events, and PDF/thumbnail/preview decoding no longer hardcodes Electron's `nativeImage`. None of that has been proven against a real second host — this change is where it gets proven, by standing up the actual Android target: a Capacitor-wrapped WebView running this same renderer, with a real `AndroidPlatformAdapter` behind it.

This is the point where the payoff of those four phases is collected: shared renderer code (`App.tsx`, the store, every component) is expected to need zero changes to run correctly on Android, because it was never written to know Electron exists.

## What Changes

- **New dependency**: Capacitor (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`) and a generated `android/` Gradle project at the repo root, alongside the existing `electron/` tree — two native shells around one `src/` renderer.
- A new mobile web build target (parallel to `electron-vite`'s existing build) that produces a plain static bundle Capacitor's `webDir` points at, and a new mobile entry point (parallel to `src/main.tsx`) that registers the Android adapter instead of the Electron one.
- **New**: `AndroidPlatformAdapter`, a full implementation of `EppAPI` (`dialog`, `fs`, `images`, `menu`, `pdf`, `print`, `settings`, `templates`) registered from that mobile entry point before first render — the same registration contract `platform-adapter` already defines, satisfied by a second adapter for the first time.
  - `settings` is backed by a Capacitor `Preferences` plugin (SharedPreferences under the hood).
  - `dialog.openImages`/`dialog.relinkImage` and `fs.openProject`/`fs.saveProject` are backed by a new small custom Capacitor plugin (Kotlin) wrapping the Storage Access Framework (`ACTION_OPEN_DOCUMENT`, `ACTION_CREATE_DOCUMENT`) — the natural Android counterpart to Electron's native file dialogs, returning `content://` URIs that the `platform-adapter` capability's existing opaque-identifier rule already anticipates.
  - `images.decodeAtSize`, ingest thumbnailing, and PDF composition for `pdf.export` run inside the WebView itself (`createImageBitmap`/`OffscreenCanvas` plus the already-portable `pdf-lib` composition and placement helpers) — no native image-decoding plugin, exactly the outcome `portable-pdf-pipeline`'s proposal called out as possible once `nativeImage` was no longer load-bearing.
  - `print.document` reuses that same in-WebView PDF composition, then hands the resulting bytes to a second small custom Capacitor plugin that invokes Android's `PrintManager` with a `PrintDocumentAdapter`, so the OS print dialog opens the way `printing`'s spec already describes generically.
  - `menu.*` subscriptions are all no-ops that return a working unsubscribe function — Android has no native menu bar, which `platform-adapter`'s totality requirement already accounts for.
- Working storage on Android (the equivalent of the Electron working directory `packaged-project-files` introduced) is an IndexedDB object store in the WebView, populated by copying bytes out of picked `content://` URIs at ingest/open time, mirroring the existing "copy at ingest, not at save" design — no native filesystem plugin needed for this (see design.md, Decision 3a).
- Explicitly out of scope: Play Store packaging/signing, app icons and branding, any touch/mobile-specific UI layout redesign beyond what `pointer-based-gestures` already covers, and byte-for-byte PDF parity with the Electron output (the WebView-based compositor is a real, working implementation, not a stub — but it is a second implementation of the same placement math against a different decode backend, and minor rendering differences versus Electron's `nativeImage`-based resize/crop are accepted, not chased, in this change).

## Capabilities

### New Capabilities

- `android-shell`: how Easy Photo Print boots on Android inside a Capacitor-wrapped WebView, what the `AndroidPlatformAdapter` does for each `EppAPI` member, and the native plugin surface (SAF-backed file access, PrintManager-backed printing) backing the parts no web API can reach — the Android counterpart to `electron-shell`.

### Modified Capabilities

(none — `platform-adapter`, `pdf-export`, `printing`, and `project-persistence` all already describe their requirements in host-neutral terms; this change satisfies them with a second adapter, it does not change what any of them require)

## Impact

- New: `android/` (Capacitor-generated Gradle project), `src/main.android.tsx` (or equivalent mobile entry point), `src/lib/platform/androidAdapter.ts`, a mobile-target Vite/build config, and the two custom Kotlin plugins (SAF file access, PrintManager printing).
- New: an in-WebView PDF composition module reusing `composeProjectPdf.helpers.ts`'s pure placement math and `pdfPlacement.ts`, paired with a Canvas-based `DecodedImage`-shaped decode step analogous to `electron/main/imageDecoder.ts`'s contract but implemented against browser APIs instead of `nativeImage`.
- `package.json`: adds `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, `@capacitor/preferences`, and a new `build:android`-style script.
- No changes to `electron/**`, `packages/layout-engine`, `packages/migrations`, or any existing renderer component — verifying that is part of this change's own acceptance criteria.
- New Kotlin source under `android/app/src/main/`, following the plugin structure Capacitor generates.
- Verification is end-to-end on a real emulator or device (build, install, launch, ingest an image, place it, export a PDF, print, save/reopen a project), not just a Gradle build succeeding — this is a UI-facing change with no existing automated test harness that can exercise a WebView/native-plugin boundary.
