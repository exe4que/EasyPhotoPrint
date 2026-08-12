## 1. Shared banner component

- [x] 1.1 Create `src/components/shell/EmptyLibraryBanner.tsx`: reads `imagePool` from the store, renders `null` when `imagePool.length > 0`, otherwise renders a full-width amber warning bar reading "Add images to library to start".
- [x] 1.2 Make it clickable: `role="button"`, `tabIndex={0}`, `onClick` and `onKeyDown` (Enter/Space) both calling an `onActivate: () => void` prop.

## 2. Desktop wiring

- [x] 2.1 In `DesktopShell.tsx`, wrap the existing `<ImageLibraryPanel />` (`:108`) in a `ref`'d `<div>`.
- [x] 2.2 Render `<EmptyLibraryBanner />` above `<PageStage />` in the middle column (`:104-109`), with local `isHighlighted` state.
- [x] 2.3 Wire `onActivate` to call `ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`, set `isHighlighted` to `true`, and clear it via `setTimeout` after ~1.2s.
- [x] 2.4 Apply `animate-bounce` and a temporary `ring-2 ring-amber-400` to the wrapper div while `isHighlighted` is `true`.

## 3. Mobile wiring

- [x] 3.1 In `MobileShell.tsx`, render `<EmptyLibraryBanner />` above `<PageStage />` (`:157-159`).
- [x] 3.2 Wire `onActivate={() => setOpenTab('photos')}`.

## 4. Verification

- [x] 4.1 `npm run typecheck` and `npm run test` pass.
- [x] 4.2 Verify via the real-Electron-under-Xvfb harness on desktop: banner is visible on a fresh/empty project, disappears after adding an image (stubbed the `dialog:open-images` IPC handler in Main for a deterministic fake asset, then clicked "Load images"), and clicking it scrolls/highlights the Image Library panel (`animate-bounce` + amber ring appear immediately, gone after the ~1.2s duration). Reappearing after emptying the library again could not be scripted — this app has no UI path to remove an image from the library once added — but the banner's visibility is a single reactive `imagePool.length === 0` selector with no separate code path or cached state for that direction, so it's covered by the same mechanism verified above.
- [x] 4.3 Verify at a mobile viewport width: the production window enforces `minWidth: 1180` (`electron/main/index.ts`), so the harness called `BrowserWindow.setMinimumSize(320, 480)` at runtime (verification-only, no source change) before resizing to 480x800. Confirmed the banner shows above the canvas while the library is empty, and clicking it opens the Photos bottom sheet (`aria-hidden` on the sheet's dialog flips from `true` to `false`).
