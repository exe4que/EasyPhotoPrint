## Context

Everything shared renderer code needs from its host already goes through one contract (`EppAPI` in `src/lib/platform/contract.ts`), selected at startup by `registerPlatformAdapter` and read via `getEppApi()` — see `openspec/specs/platform-adapter/spec.md`. The Electron adapter (`src/lib/platform/electronAdapter.ts`) is a thin pass-through over `window.eppAPI`. This change writes the second adapter the contract was built for, plus the native shell around it.

Two things `platform-adapter`'s own spec already commits to make this tractable:
- Location identifiers (`storedPath`, a saved project's path) are opaque — Android's `content://` URIs satisfy the contract exactly as well as Electron's filesystem paths, with zero renderer-visible difference.
- `.eppproj` is fully self-contained (`packaged-project-files`) and PDF/thumbnail/preview decoding no longer needs a host-specific image API (`portable-pdf-pipeline`) — both preconditions this change was explicitly staged to depend on.

(A third precondition existed in this design's first draft: "the contract is total, so Android's missing native menu bar is absorbed as eight no-op `menu` subscriptions." That held only until Decision 8 below — once a shared toolbar covered the same eight actions identically on both hosts, the `menu` contract namespace itself was removed rather than kept as permanent no-ops on one host and dead weight on the other.)

No mobile toolchain, Capacitor dependency, or `android/` project exists in this repo yet. This design covers standing all of that up for the first time.

## Goals / Non-Goals

**Goals:**
- The existing renderer (`src/`) runs on Android with no *architectural* changes, proving the four prior phases actually decoupled it from Electron — the one exception found by end-to-end verification (Decision 8, the shared toolbar) is a deliberate, additive UI change, not evidence shared code was Electron-coupled.
- Every `EppAPI` member has a real, working Android implementation — no member throws "not implemented" or silently no-ops.
- The whole thing is verifiable by building, installing, and driving the app on a real emulator or device.

**Non-Goals:**
- Not publishing to the Play Store, not app icons/branding, not a touch-optimized layout redesign (`pointer-based-gestures` already made every gesture input-agnostic; this change doesn't revisit layout).
- Not byte-for-byte PDF output parity with Electron. The Android compositor reuses the same pure placement math but a different decode/resize backend (browser Canvas instead of `nativeImage`); minor rendering differences are accepted.
- Not building a CI/emulator matrix. Verification for this change is manual, the same posture every prior phase's E2E recipe already took for desktop.
- Not sharing one compositor module between Electron Main and the Android WebView at the source level in this change. Both call the same pure helpers (`composeProjectPdf.helpers.ts`, `pdfPlacement.ts`); the decode/encode glue around them is written twice, once per runtime, because the two runtimes' decode APIs (`nativeImage` vs. `createImageBitmap`/`OffscreenCanvas`) are different enough that a shared abstraction would be speculative before a second real caller exists to validate it against — the same YAGNI reasoning `portable-pdf-pipeline`'s design.md used for not generalizing `ImageDecoder` beyond Electron.

## Decisions

### 1. Capacitor, not a hand-rolled WebView shell

Capacitor is the vehicle every prior proposal's language ("Capacitor/Android WebView") already assumed. It gives a maintained `android/` Gradle project, a WebView host with a sane default security posture (HTTPS-scheme local server, not raw `file://`), a plugin SDK for the two custom Java plugins this change needs, and an official `Preferences` plugin for settings. Building a raw `WebView`-in-an-`Activity` shell by hand would mean reimplementing all of that (plugin bridging, JS↔native message passing, lifecycle handling) for no benefit — Capacitor's whole purpose is to be this layer.

Alternative considered: React Native. Rejected outright — it would mean rewriting every component in `src/`, not reusing them, which defeats the entire point of the four prior phases.

### 2. Two build targets, one `src/`

`electron-vite` already builds `src/` for the Electron renderer. This change adds a second Vite build (a new `vite.mobile.config.ts` or an additional target in the existing Vite config) that produces a plain static bundle — no Electron-specific chunking, no `out/main`/`out/preload` — written to a directory Capacitor's `capacitor.config.ts` `webDir` points at. A new entry point (`src/main.android.tsx`, mirroring `src/main.tsx`) calls `registerPlatformAdapter(createAndroidAdapter())` before rendering; `src/main.tsx` is untouched.

Both entry points import the same `App.tsx` and the same store. Nothing under `src/components`, `src/store`, `src/hooks`, or `src/lib` (other than the new `androidAdapter.ts` file and its supporting modules) changes — confirming that is part of this change's acceptance criteria, per the proposal.

### 3. `dialog`/`fs` go through a custom SAF-backed Capacitor plugin, not `@capacitor/filesystem`

`@capacitor/filesystem` operates on Capacitor's own `Directory` enum (app data, cache, external storage) — it has no `ACTION_OPEN_DOCUMENT`/`ACTION_CREATE_DOCUMENT` picker and no persistent `content://` URI story, so it can't produce the "user picks a file, gets a real result back" interaction `dialog.openImages`/`fs.openProject`/`fs.saveProject` need. A small custom Java plugin (`SafFilePlugin` or similar) wraps three Android intents directly:
- `ACTION_OPEN_DOCUMENT` (`GetContent`-style multi-select, MIME-filtered to image types) for `dialog.openImages`.
- `ACTION_OPEN_DOCUMENT` (single-select, MIME-filtered) for `dialog.relinkImage` and `fs.openProject` (filtered by `.eppproj`'s registered MIME/extension).
- `ACTION_CREATE_DOCUMENT` for `fs.saveProject`'s "Save As" path; the plain "Save" path (an already-known `content://` URI) writes directly via `ContentResolver.openOutputStream` with no new intent.

Each returned `content://` URI is read via `ContentResolver` and its bytes handed back to the TS side as base64 — no native cache-directory write happens in the plugin itself (see Decision 3a below for where those bytes end up). The TS-side `AndroidAdapter` methods that call this plugin are what perform the "copy in, decode, thumbnail" sequence `fs.handlers.ts`'s `createImageAssetFromPath`/`regenerateImageAsset` perform on Electron — the plugin's job stops at "here are the picked URI(s) and their raw bytes."

### 3a. Working storage lives in IndexedDB, not a native cache directory (refined during implementation)

The original draft of this decision described copying picked bytes into "the app's private cache directory," implying a native filesystem write via a plugin like `@capacitor/filesystem`. Implementing task 5/7 surfaced a simpler option that needs no new native dependency at all: `packaged-project-files`' working-storage concept only requires *some* place bytes can be written once and re-read many times for the life of a session (and across app restarts, for a saved-but-reopened project) — it never required that place to be the OS filesystem. IndexedDB (native to the WebView, already durable across app restarts, with a quota generous enough for a photo-layout tool's typical project size) satisfies exactly the same contract with zero new native surface: one more thing that doesn't need a Java plugin, consistent with this change's overall thesis of pushing decode/compose work into the WebView wherever a native API isn't strictly required.

Each ingested/extracted image's bytes are stored as a `Blob` in an IndexedDB object store keyed by `assetId`. `ImageAsset.storedPath` (opaque per `platform-adapter`'s existing rule) becomes that `assetId` on Android — not a `content://` URI, not a filesystem path, just the key the renderer's own working-storage module needs to look the bytes back up. This is a legitimate host-specific interpretation of an already-opaque identifier, the same way Electron's `storedPath` is a filesystem path and nothing outside the adapter is allowed to assume otherwise.

Alternative considered: a community file-picker plugin (e.g. `@capawesome-team/capacitor-file-picker`). Rejected for `fs.saveProject`/`fs.openProject` specifically — community pickers are typically read-oriented (`ACTION_OPEN_DOCUMENT` only) and don't cover the `ACTION_CREATE_DOCUMENT` "Save As" flow this contract needs; mixing a community plugin for reads with a custom plugin for writes would be more total complexity than one small custom plugin covering both.

### 4. PDF composition and image decode run in the WebView, not in a plugin

`portable-pdf-pipeline` deliberately shaped `ImageDecoder`/`DecodedImage` around exactly the operations `composeProjectPdf.ts` uses, and its design.md named the WebView's own `createImageBitmap`/`OffscreenCanvas` as a viable decode backend. This change cashes that in: a new TS module (parallel to `electron/main/pdf/composeProjectPdf.ts`, not a shared file — see Non-Goals) runs entirely in the renderer bundle, calling `composeProjectPdf.helpers.ts`'s `computePagePlacements` (pure, already portable) and `pdfPlacement.ts`'s placement math (pure, already portable) exactly as Electron's compositor does, but decoding/cropping/resizing images via `createImageBitmap` + `OffscreenCanvas.getContext('2d')` instead of `nativeImage`, and encoding via `OffscreenCanvas.convertToBlob({ type: 'image/jpeg' })` instead of `toJPEG`. `pdf-lib` itself needs no substitution — it already runs identically in a browser.

`images.decodeAtSize` (print-resolution preview) and ingest-time thumbnailing follow the same pattern at smaller scale: `createImageBitmap` from the `Blob` read back out of IndexedDB (Decision 3a), draw to an `OffscreenCanvas` sized per `computeCoverDecodeSize`/`computeThumbnailSize` (both already pure). These two functions are Main-process-local (`fs.handlers.ts`/`fs.helpers.ts`, under `electron/main/ipc/`); this change ports their pure logic, not their file, into a renderer-side module, since importing across the Electron/renderer boundary isn't meaningful — Android's equivalent helper is a new module with the same pure logic, not a shared import.

This means: no native image-decoding plugin exists in this change at all. That's the direct payoff `portable-pdf-pipeline`'s proposal named as the reason for building that contract in the first place.

**The rule this settles on, made explicit for task 7:** a file under `electron/main/**` is importable directly from the Android bundle exactly when it has no `node:`/`electron` runtime dependency and every symbol needed is actually exported — the boundary that matters is *runtime dependency*, not directory location. `composeProjectPdf.helpers.ts` and `fs.helpers.ts`'s `normalizeProjectDocument`/`prepareProjectForSave`/`applyRegeneratedImage` all qualify and are imported directly (duplicating `normalizeProjectDocument`'s ~150 lines of structural validation would be a real drift risk for no benefit). Two things don't qualify, and are ported/rewritten instead: `fs.handlers.ts`'s `computeThumbnailSize` (not exported, and the file itself imports `electron`/`node:fs`) and `computeCoverDecodeSize` (exported and pure, but duplicated alongside `computeThumbnailSize` for locality since the former had to be duplicated anyway) live in `thumbnailSize.ts`; `projectBundle.ts`'s zip build/extract (hard `node:fs`/`node:path` dependency, and its actual file-system behavior doesn't apply to IndexedDB working storage anyway) gets an Android-specific rewrite in task 7.3/7.4 using the same `project.json` + `images/<assetId><ext>` container shape.

### 5. Printing reuses the same in-WebView compositor, handed off to a second small Java plugin

`print.document` calls the same in-WebView compositor `pdf.export` uses to produce PDF bytes, then passes those bytes (as a base64 string, Capacitor's standard plugin-call payload shape) to a second custom Java plugin (`PrintPlugin`) that writes them to a temp file and calls `PrintManager.print(...)` with a `PrintDocumentAdapter` implementation that streams that file — the standard, well-documented Android pattern for "print an already-rendered PDF." This opens the real OS print dialog, satisfying `printing`'s existing host-neutral requirement text ("the operating system's native print dialog") the same way Electron's `webContents.print()` does today.

Alternative considered: driving print through the WebView's own `window.print()`. Rejected — that prints the currently-loaded HTML page's rendered content via Chrome's print pipeline, not the composed PDF (which accounts for exact placement/crop/DPI the same way Export does); using it would mean `print.document` and `pdf.export` diverge in what they actually produce, which `printing`'s spec explicitly requires them not to ("rendered exactly as print preview renders it").

### 6. Settings via the official `@capacitor/preferences` plugin

`AppSettings` is a small, flat key-value shape (`unitSystem`, `defaultPrinterName?`) with no query/relational needs — exactly `@capacitor/preferences`'s (SharedPreferences-backed) use case. Using the official, maintained plugin here instead of a third custom one keeps the two custom plugins in this change scoped to the things Capacitor genuinely has no first-party answer for (SAF document picking, PDF printing).

### 7. (superseded by Decision 9 — see below)

The first draft of this design gave Android's adapter eight no-op `menu` subscriptions, directly justified by `platform-adapter`'s "Platform Contract Is Total" requirement. That was a reasonable first cut, but Decision 8/9 below removed the `menu` contract namespace entirely once a shared toolbar made it unnecessary on both hosts — so there is no `menu` block in the shipped `androidAdapter.ts` at all, no-op or otherwise. Left here, struck through in spirit, so the numbering in this document stays stable and the reasoning trail stays visible.

### 8. A shared toolbar replaces "menu-only" for eight actions, on both hosts

End-to-end verification on a real device (section 10 of tasks.md) surfaced that `New`/`Open`/`Save`/`Save As`/`Undo`/`Redo`/`Save Template`/`Save Template As` were wired in `App.tsx` and `SaveTemplateDialog.tsx` exclusively through `getEppApi().menu.on*` listeners. Decision 7's no-op subscriptions made those listeners correctly inert on Android (no native menu bar) — but nothing else in the app could trigger the actions they gated, so as shipped through task group 8, an Android user could ingest images, lay out a page, export a PDF, and print, but could never save or reopen a project, or undo/redo a mistake. That's not a cosmetic gap; it's most of `project-persistence` and all of `undo-redo` being practically unreachable on this host.

Two requirements stood in the way of the obvious fix:
- `undo-redo`'s "Undo and Redo Controls" requirement: "There SHALL NOT be a dedicated in-app toolbar button for undo or redo."
- `editor-layout`'s "Save Template Has No Standalone Panel" requirement: saving/overwriting a template "SHALL be reachable only through the `Edit > Save Template` and `Edit > Save Template As...` menu items."

Both were correct, deliberate decisions *when written* — `wire-menu-undo-redo` and `trim-edit-menu-and-reorganize-panels` were about not cluttering a single-host desktop UI with a second way to do something the native menu already covered well. Neither anticipated a host with no native menu at all. Confirmed with the user rather than resolved silently (per AGENTS.md §3): both requirements are revised so a toolbar becomes a trigger path for all eight actions on every host. (This first iteration kept the toolbar as an *additional* trigger alongside Electron's still-unchanged native menu — see Decision 9 for why that didn't last.)

**Why one shared toolbar component instead of an Android-only one:** the alternative — a toolbar rendered only when `getEppApi()` is the Android adapter, or gated behind some `isTouchHost` flag — would work, but it reintroduces exactly the kind of host-conditional branching in shared code that `platform-adapter`'s whole contract exists to avoid, for a problem that doesn't need it: nothing about these eight actions is Android-specific, a toolbar is a perfectly normal desktop affordance too, and one code path is easier to keep correct than two. `SaveTemplateDialog` is refactored (`forwardRef`/`useImperativeHandle`) to expose its existing save/save-as logic to the new toolbar button without duplicating it.

**Why not disable Undo/Redo based on history availability:** the toolbar buttons are never disabled based on history state, to avoid adding new store surface (a `canUndo`/`canRedo` selector) this change doesn't otherwise need; invoking undo/redo with nothing to undo/redo is simply a no-op, matching the underlying temporal store's own behavior.

### 9. The native Electron menu is removed entirely, not kept alongside the toolbar

Once Decision 8's toolbar covered all eight actions identically on every host, keeping Electron's native menu (`electron/main/menu.ts`, the `menu:*` IPC channels, the preload's `menu` bindings, and `EppAPI`'s `menu` contract namespace) meant maintaining a second, Electron-only trigger path for functionality the toolbar already fully covered — the opposite of this change's goal of minimizing divergence between the two builds. Confirmed with the user before removing it (per AGENTS.md §3, since it meant reversing `electron-shell`'s "Trimmed application menu" requirement and every "menu round-trip" requirement it defined, not just extending them): the menu, its channels, and the whole `menu` contract namespace are deleted outright, on every host, not just Android.

What's kept: on macOS, `Menu.setApplicationMenu` still runs with the OS-standard `appMenu` role (About/Hide/Services/Quit) — that's platform convention Electron apps are expected to provide, orthogonal to this app's own File/Edit actions, not something the toolbar replaces. Windows/Linux get no application menu bar at all (`Menu.setApplicationMenu(null)`).

What's replaced, not dropped: the `CmdOrCtrl+N/O/S/Shift+S/Z/Shift+Z` keyboard shortcuts the old menu's `accelerator` properties provided. Losing them silently would be a real, if minor, desktop UX regression — Electron power users expect them. They're reimplemented as a `keydown` listener in `App.tsx` (the same component already handling the `Escape` shortcut for exiting preview/clearing selection), calling the exact same store actions the toolbar buttons call. This is shared code too: harmless on Android (a hardware keyboard is rare, but nothing breaks if `Ctrl+Z` arrives from a Bluetooth one), and it's what makes the removal a genuine like-for-like replacement rather than a quiet feature loss. `Save Template`/`Save Template As` had no keyboard accelerator in the original menu, so none is added here either.

**Consequence for `platform-adapter`:** with `menu` gone from `EppAPI` entirely, "The Platform Contract Is Total" requirement's one example scenario (illustrated using `menu` — "a host without host-initiated commands still satisfies the contract") no longer has a real member to illustrate. The requirement itself is untouched; only that one now-hypothetical example scenario is dropped (see this change's `platform-adapter` delta spec).

## Risks / Trade-offs

- [Two independent PDF compositors (Electron's `nativeImage`-backed, Android's Canvas-backed) can drift in behavior over time as each is modified independently] → Accepted per Non-Goals; both call the same pure placement math, so drift is limited to decode/resize/encode fidelity, not layout correctness. Revisit sharing a real abstraction only once a second real implementation's rough edges are known, not speculatively.
- [Custom Java plugins are new surface with no prior art in this repo — SAF intent handling and `PrintDocumentAdapter` both have real edge cases (permission denial, `ACTION_CREATE_DOCUMENT` cancellation, print job failure)] → Scoped narrowly (three SAF intents, one print call) and covered by the manual E2E verification pass this change requires before archiving, the same bar `pointer-based-gestures` set for gesture code with no unit-test harness.
- [No CI or emulator automation verifies this on every future change] → Accepted per Non-Goals; the existing desktop E2E recipe has the same property (manual, Playwright-driven, run on demand) and this change doesn't raise the bar beyond that precedent.
- [Copying picked bytes into IndexedDB means large image libraries consume device storage twice (source + IndexedDB copy), same trade-off `packaged-project-files` already accepted on desktop] → Same reasoning applies: acceptable for a photo-layout tool's typical project size.
- [IndexedDB storage is per-WebView-origin and is something the OS/user can clear (e.g. "Clear storage" in Android's app-info settings) independently of the app being uninstalled] → Accepted: this is working storage, not the permanent record (the saved `.eppproj` file is); the existing "missing image" detection and relink flow already handles a working copy becoming unreadable, the same way it handles a corrupted bundle entry today.
- [Removing Electron's native menu (Decision 9) is a real desktop behavior change for any existing user: `File`/`Edit` no longer exist in the OS menu bar at all, and muscle memory pointed at a menu item (as opposed to a keyboard shortcut, which still works) breaks] → Deliberate, confirmed with the user (this app has not shipped, so there is no installed base to break); the toolbar is always visible at the top of the window, arguably more discoverable than a menu bar for a new user, and every keyboard shortcut the menu provided still works identically.
- [The reimplemented keyboard-shortcut handler (Decision 9) is new shared-code surface with no direct prior art in this repo (the closest precedent, the existing `Escape` handler in the same `useEffect`, is single-key with no modifier); a bug here affects both platforms at once, where a native-menu accelerator bug would have only ever affected Electron] → Scoped narrowly (six key combinations, all delegating to already-tested store actions/toolbar click handlers) and covered by the same Electron E2E verification pass (Playwright) this change already runs for the toolbar itself.

## Migration Plan

None — this is wholly new, additive surface (a new build target, a new adapter, a new native project). No existing Electron code path, IPC channel, or file format changes. Nothing to roll back beyond removing the new files if the approach needs revisiting.

## Open Questions

- Exact minimum Android API level / target SDK version to declare in `android/app/build.gradle` — left to `tasks.md` to pin against whatever Capacitor's current stable release recommends at implementation time, rather than freezing a number here that may already be stale.
