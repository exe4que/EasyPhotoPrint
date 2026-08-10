## Context

Two files import `nativeImage` from `electron` directly, and the exact operations they call are narrow and easy to enumerate:

- `fs.handlers.ts`'s `decodeAndThumbnail(filePath)`: `createFromPath` → `getSize` → `resize` → `toDataURL`. Used for ingest (`createImageAssetFromPath`) and re-extraction on project open (`regenerateImageAsset`).
- `fs.handlers.ts`'s `decodeImageAtSize(filePath, minW, minH)`: `createFromPath` → `getSize` → `resize` → `toDataURL`. Used for print-resolution preview (`images:decode-at-size`).
- `composeProjectPdf.ts`'s `embedPlacedImage`: `createFromPath` → `getSize` → (conditionally) `crop` → `resize` → `toJPEG`. Used for PDF composition.

Every other dependency in both files (`pdf-lib`, `computeCoverDecodeSize`, the pure placement/geometry helpers) already runs in any JS engine. `nativeImage` is the one thing anchoring this code to Electron specifically. See proposal.md - Why for the broader motivation.

## Goals / Non-Goals

**Goals:**
- No file outside one small adapter imports `nativeImage`.
- PDF, thumbnail, and print-preview output is byte-for-byte unchanged.
- The contract is scoped to exactly the six operations actually used today — no speculative surface for capabilities nothing currently needs.

**Non-Goals:**
- Not implementing an Android/Capacitor decoder. This change proves the seam holds with one implementation behind it, the same posture `extract-platform-adapter` took for the renderer's IPC surface.
- Not relocating `composeProjectPdf.ts` out of `electron/main/pdf/`. The architectural point — that its logic *could* run in a WebView via `createImageBitmap`/`OffscreenCanvas` once decoupled from `nativeImage` — is worth naming (see proposal.md - Why), but actually moving the file is a separate decision for whenever an Android target exists to justify it.
- Not building a registry/adapter-selection mechanism for this seam (see Decision 2).

## Decisions

### 1. The contract's shape mirrors `nativeImage`'s used subset exactly; the Electron implementation is a pass-through

`DecodedImage` (`getSize`, `resize`, `crop`, `toDataURL`, `toJPEG`) and `ImageDecoder` (`decodeFromPath`) are typed to capture precisely the six operations enumerated in Context — nothing broader. `createElectronImageDecoder()`'s `decodeFromPath` returns `nativeImage.createFromPath(filePath)` directly; Electron's `NativeImage` already satisfies `DecodedImage`'s shape, so there's no wrapping object, no re-implementation of `resize`/`crop`/etc., and no room for behavior to drift from what exists today. This is the same call `extract-platform-adapter`'s design.md made for its Electron adapter (Decision 2 there): a pass-through is strictly simpler than a forwarding wrapper and guarantees byte-for-byte-identical behavior rather than merely intending it.

Alternative considered: design the interface around a more "generic" shape (e.g., operate on raw `ArrayBuffer`/`ImageData` instead of an opaque handle object) to look more like what a browser-based implementation would naturally want. Rejected for now — it would mean re-implementing `resize`/`crop`/`toJPEG` against `nativeImage`'s actual API instead of using it directly, adding real code and risk for a shape that's speculative until an Android implementation actually exists to validate it against. YAGNI: shape the contract to today's one real implementation; reshape it later against a second real implementation, not a guessed one.

### 2. No registry — this seam is per-deployment-target, not per-runtime-branch

`platform-adapter`'s `registerPlatformAdapter` exists because the *same renderer bundle* can run under different hosts and must pick an implementation at startup. `electron/main/**` has no equivalent situation: it is Electron's Main process, full stop, in every build this repo produces, and there is no future world where the same `electron/main` bundle also runs as "Android's main process" — Capacitor's architecture doesn't have a Main-process equivalent; native capabilities are separate Kotlin/Java plugins, and per Decision 2 in proposal.md's Why, an Android PDF pipeline may not need a native plugin at all if it runs the (by-then-portable) composition logic directly in the WebView using browser-native decode APIs.

So the two real deployment targets this contract will ever serve — "Electron's Main process" and "wherever a future Android PDF pipeline actually lives" — are two different files being written at two different times, not one file choosing between two adapters at runtime. Each constructs its own decoder directly. Adding a registry here would be process ceremony copied from a different problem shape, not a needed abstraction.

### 3. `decodeFromPath` is async; the rest of the interface stays synchronous

Reading and decoding a file from disk is the one operation that's genuinely I/O-bound and platform-variable — `nativeImage.createFromPath` happens to be synchronous today, but that's an Electron implementation detail, not something worth freezing into the contract. Every other operation in `DecodedImage` (`getSize`, `resize`, `crop`, `toDataURL`, `toJPEG`) operates on an *already-decoded, in-memory* bitmap, and `nativeImage`'s versions of all five are genuinely synchronous — there is exactly one real implementation to shape this contract against (per Decision 1's YAGNI reasoning), and it's synchronous, so the contract is too.

This makes `fs.handlers.ts`'s `regenerateImageAsset` async (it now `await`s `decodeAndThumbnail`, which now `await`s `decodeFromPath`) — a small, mechanical, one-call-site ripple: its only caller already maps over `imagePool` inside an `async` IPC handler, so that `.map(...)` becomes `await Promise.all(imagePool.map(async (asset) => ...))`.

## Risks / Trade-offs

- [The contract is shaped around one implementation (Electron's), so it might not fit an Android decoder's natural shape without adjustment] → Accepted per Non-Goals; reshaping a contract against a second real implementation, once one exists, is normal and cheap compared to guessing its shape now against a platform with no code here yet.
- [`toJPEG` returns Node's `Buffer` type, which doesn't exist in a browser/WebView] → Narrow and easy to revisit: only `composeProjectPdf.ts` calls it, and only to hand the bytes to `pdfDoc.embedJpg(...)`, which accepts any `Uint8Array` — a future non-Node implementation returning `Uint8Array` instead of `Buffer` (a subclass, so today's Electron implementation trivially satisfies either) would need no change on the calling side.

## Migration Plan

None — this is an internal refactor with no persisted-data or external-contract implications. No IPC channel, file format, or user-facing behavior changes.
