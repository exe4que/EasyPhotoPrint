## Why

`android-shell` shipped a fully working Android target, but explicitly left "any touch/mobile-specific UI layout redesign beyond what `pointer-based-gestures` already covers" out of scope. The app on a phone today renders the exact same desktop layout: a `[320px_1fr_360px]` three-column grid that, below `lg`, silently collapses to a single vertical stack via existing Tailwind responsive classes — sidebars pile up above and below the canvas, which lands buried mid-scroll. Every screenshot taken during `android-shell`'s own E2E verification shows this: usable enough to prove the platform adapter works, but not an editor anyone would choose to use on a 6" screen.

This is Phase 04 of the Android-port research plan (`extract-platform-adapter` → `packaged-project-files` → `pointer-based-gestures` → `portable-pdf-pipeline` → **this phase, deferred** → `android-shell`, done out of order because standing up the real Android target first was more valuable to prove end-to-end than a layout only Electron could exercise). The plan's own design — canvas-first, bottom-sheet controls — is unchanged; this proposal grounds it against the code as it exists today, five archived changes later.

## What Changes

- A `useIsMobileViewport()` hook detects the same breakpoint Tailwind's `lg:` prefix already uses (1024px) reactively at runtime (`matchMedia`, not a one-time read), so `App.tsx` can choose between two entirely different component trees, not just restyle one.
- `App.tsx`'s current desktop JSX is extracted verbatim into `DesktopShell` — **no behavior change on desktop, at any width**, this is a pure extraction.
- A new `MobileShell` renders below the breakpoint: the canvas (`PageStage`, already self-contained with its own zoom controls and `PageSwitcher` page-navigation strip) fills the viewport and is never scrolled off-screen; a compact header hosts the existing `MenuBar` and `UnitToggle`/`Preview` controls; a bottom tab bar with four destinations (`Page`, `Layout`, `Photos`, `Templates`) opens a bottom sheet showing that destination's panel; the `Properties` panel rises as its own sheet automatically when a slot/element is selected (reading the same `ui.selection` store state `PageStage` already reads) and lowers on deselect, rather than occupying a fifth tab.
- **BREAKING (internal only)**: `CollapsiblePanel` gains a `bare` prop that skips its title/description/collapse-chevron header while still rendering `headerAction`/`actions` content; `PageSetupPanel`, `ImageLibraryPanel`, `LayoutTreePanel`, `PropertiesPanel`, and `TemplateGallery` each gain a `bare?: boolean` prop they forward to their own internal `CollapsiblePanel` call. This is what makes "reuse the same panel components in both shells without duplicating their logic" true given each panel already wraps *itself* in `CollapsiblePanel` internally (verified against current code — the original plan assumed the wrapping was external and applied by `App.tsx`; it isn't). No existing call site's behavior changes: every current usage omits `bare`, which defaults to `false`.
- Nested layout mode works identically on mobile — `LayoutTreePanel` and `NodeDivider` render inside the `Layout` tab's sheet exactly as they do in the desktop sidebar, no mobile-specific restriction (confirmed with the user; the original plan left this as an open product question).
- Explicitly out of scope, per the original plan's own reasoning (not re-litigated here): a side-drawer/hamburger nav (covers the canvas, loses live feedback), top tabs (eats scarce portrait height, out of thumb reach), and a single-column stack (today's default — the exact problem this change fixes). Also out of scope: any change to `PageStage`'s own internals, `NodeDivider`/`FreeformElement` gesture code (already input-agnostic since `pointer-based-gestures`), or any Android-specific code — this is a viewport-width-driven UI change, verifiable entirely on desktop by resizing the window, the same posture `pointer-based-gestures` and `responsive-shell`'s four predecessor phases already established.

## Capabilities

### New Capabilities

- `mobile-shell`: the bottom-sheet, canvas-first editor shell shown below the `lg` breakpoint — its four tab destinations, the auto-rising Properties sheet, and the guarantee that it reuses the same panel components and store logic as the desktop shell rather than a parallel implementation.

### Modified Capabilities

- `editor-layout`: currently describes panel placement in host-agnostic terms ("the right sidebar," "either sidebar") that implicitly assumed one shell. Adds an explicit scoping note that its existing requirements (Save Template has no standalone panel, Layout Tree panel position) describe the desktop/wide-viewport shell specifically, now that a second shell with a different panel arrangement exists.

## Impact

- New: `src/hooks/useIsMobileViewport.ts`, `src/components/shell/DesktopShell.tsx` (extracted, unchanged behavior), `src/components/shell/MobileShell.tsx`, `src/components/shell/BottomSheet.tsx` (or similar — the shared sheet chrome: grabber, title, backdrop, open/close), `src/components/shell/BottomTabBar.tsx`.
- `src/App.tsx`: shrinks to the breakpoint check plus rendering whichever shell applies; all state/handlers currently defined there (confirm dialogs, keyboard shortcuts, the `SaveTemplateDialog` ref) stay in `App.tsx` and are passed down, since both shells need them identically.
- `src/components/ui/CollapsiblePanel.tsx`: new `bare` prop, additive.
- `src/components/panels/{PageSetupPanel,ImageLibraryPanel,LayoutTreePanel,PropertiesPanel}.tsx`, `src/components/templates/TemplateGallery.tsx`: each gains a `bare?: boolean` prop threaded to its internal `CollapsiblePanel` call. No other change to any of these files — their store reads, handlers, and rendered content are untouched.
- No changes to `packages/layout-engine`, `packages/migrations`, `electron/**`, `android/**`, or any platform adapter — this is `src/components`/`src/App.tsx` only.
- No new automated tests beyond what a pure layout/UI change can reasonably have (existing store/hook unit tests are unaffected since no store shape changes). Verification is manual: resizing the Electron window across the breakpoint (primary, fast-iteration path) and a pass on the Android emulator (matching the bar `android-shell` already established for UI-facing changes).
