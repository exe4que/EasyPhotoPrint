## 1. `CollapsiblePanel` bare mode

- [x] 1.1 Add a `bare?: boolean` prop to `CollapsiblePanel` (default `false`). When `true`, skip the title/description/collapse-chevron header entirely (never collapsed — there's no chevron to click); still render `headerAction` and `actions` if provided, followed by `children`.
- [x] 1.2 Add `bare?: boolean` to `PageSetupPanel`, `ImageLibraryPanel`, `LayoutTreePanel`, `PropertiesPanel` (all four of its `CollapsiblePanel` call sites), and `TemplateGallery`, forwarding it to each component's internal `CollapsiblePanel` call.
- [x] 1.3 Confirm every existing call site (still only inside `App.tsx` at this point) omits the new prop — `bare` defaults to `false`, so current rendering is provably unchanged. Run the full test suite and typecheck to confirm nothing broke.

## 2. Breakpoint detection

- [x] 2.1 Add `src/hooks/useIsMobileViewport.ts`: a hook wrapping `window.matchMedia('(max-width: 1023.98px)')` with a `change` listener, returning a boolean, updating reactively on resize (no full remount of `App.tsx`).
- [x] 2.2 Confirmed this project's Vitest setup runs in the default `node` test environment (no `jsdom`, no `window`/`matchMedia` — checked directly: `typeof window === 'undefined'` in a throwaway test). Unit testing a `window.matchMedia`-driven hook would need a `jsdom` environment this project doesn't have and hasn't needed for anything else (consistent with `pointer-based-gestures`' own "no component-test framework" precedent) — adding one is out of scope for this change. Covered by manual verification instead (sections 9/10).

## 3. Extract `DesktopShell`

- [x] 3.1 Create `src/components/shell/DesktopShell.tsx`. Move the desktop JSX (the `<main>...</main>` block, including the sticky header with `MenuBar`/title/`UnitToggle`/Preview button and the three-column grid) out of `App.tsx` verbatim. Accept the four dialog-trigger props (`onRequestNew`, `onRequestOpen`, `onSaveTemplate`, `onSaveTemplateAs`) plus a fifth `templateLibrary` prop (lifted from `App.tsx` rather than called independently here — `useTemplateLibrary` is local `useState`, not global store state, so a second independent instance would drift out of sync with the one `SaveTemplateDialog` reloads after a save) instead of reading local `App.tsx` state directly; read everything else (`unitSystem`, `layoutMode`, `viewMode`/`setViewMode`, `saveProject`, `undo`/`redo`, `imagePool`, page state, `isSimpleModeAvailable`) directly via `useEPPStore`/the existing hooks, the same way `PageStage` and the panels already do.
- [x] 3.2 Update `App.tsx` to render `<DesktopShell ...5 props... />` in place of the extracted JSX. Verified via Playwright/xvfb (screenshot + programmatic checks for File/Edit menu, Document/Page setup/Image library/Slot properties panels, and a File→New→Cancel functional smoke test) that rendering is pixel-identical to before the extraction — zero visible change.

## 4. `MobileShell` scaffold: compact header and canvas-first layout

- [x] 4.1 Create `src/components/shell/MobileShell.tsx` with a compact header (the existing `MenuBar` and `UnitToggle`/Preview button, rearranged for a narrow width — dropped the subtitle text entirely at this width) and a canvas area rendering `PageStage` at full remaining height, so the canvas is always visible per the `mobile-shell` capability's "Mobile Shell Is Canvas-First" requirement. `App.tsx` was wired to `useIsMobileViewport()` ahead of task 8.1 (needed to test this and the following groups by resizing the real window, the same way task 3.2 verified `DesktopShell`); 8.1's own checkbox is left for when the full mobile shell — sheets, tab bar, Properties auto-sheet — is in place.
- [x] 4.2 Verified (resizing the Electron window to 480x800 via Playwright/xvfb) that the canvas renders and is fully visible with no bottom sheet open yet; the compact File/Edit menu, unit toggle, Preview button, and page switcher are all present, the desktop-only Document panel is absent, and resizing back above 1024px restores `DesktopShell` cleanly.

## 5. Bottom sheet and tab bar chrome

- [x] 5.1 Add `src/components/shell/BottomSheet.tsx`: shared sheet chrome (backdrop, grabber, title slot for the active destination's label, close on backdrop tap or an explicit close control), sliding open/closed via a CSS transition — no drag-to-dismiss gesture (see design.md Non-Goals).
- [x] 5.2 Add `src/components/shell/BottomTabBar.tsx`: a persistent bottom bar with four destinations (`Page`, `Layout`, `Photos`, `Templates`); activating the open destination again, or closing the sheet another way, closes it — per the `mobile-shell` capability's "Bottom Tab Bar With Four Destinations" requirement.
- [x] 5.3 Wire `MobileShell` to hold which tab (if any) is open, rendering `BottomSheet` with the corresponding panel component (`bare`) as its content: `Page` → `PageSetupPanel`, `Photos` → `ImageLibraryPanel`, `Templates` → `TemplateGallery`.
- [x] 5.4 Wire the `Layout` destination: the Simple/Nested toggle (extracted, along with the read-only Document summary it sits beside, into a new shared `src/components/shell/DocumentSummary.tsx` both shells render — `DesktopShell` still wraps it in its own "Document" `CollapsiblePanel`, `MobileShell` renders it bare since the sheet chrome already supplies the "Layout" title) plus — in Nested mode — `LayoutTreePanel` (bare) below the toggle, per design.md Decision 4. Verified via Playwright/xvfb at 480x800: all four tabs open the correct panel content and read the same store, tapping an open tab again or tapping the backdrop closes it, opening a different tab switches directly without stacking, and switching to Nested mode in the Layout sheet reveals `LayoutTreePanel`'s content.

## 6. Properties auto-sheet on selection

- [ ] 6.1 In `MobileShell`, read `ui.selection` from the store and open a `BottomSheet` showing `PropertiesPanel` (bare) automatically whenever selection is non-null, closing automatically when it's cleared — independent of the tab-bar's own open/closed state (selecting something while a tab sheet is open should switch to the Properties sheet, not stack on top of it).
- [ ] 6.2 Verify: selecting an image slot, a freeform element, and a library image on the resized-down Electron window each open the Properties sheet; clearing selection (tapping empty canvas space, or pressing Escape) closes it.

## 7. Persistent page navigation

- [ ] 7.1 Confirm `PageStage`'s existing `PageSwitcher` (prev/next/add-page) remains visible and functional in `MobileShell` with no changes needed to `PageStage` itself — verify it isn't obscured by the bottom tab bar or an open sheet.

## 8. Wire `App.tsx`

- [ ] 8.1 `App.tsx` calls `useIsMobileViewport()` and renders `viewMode === 'preview' ? <PreviewScreen /> : isMobileViewport ? <MobileShell ...5 props... /> : <DesktopShell ...same 5 props... />`, followed by the unchanged `SaveTemplateDialog`/`ConfirmDialog` block.
- [ ] 8.2 Run the full test suite and typecheck.

## 9. Desktop verification (primary path — resize the Electron window)

- [ ] 9.1 Launch the Electron app at full width: confirm `DesktopShell` renders exactly as before this change (no regressions from the extraction).
- [ ] 9.2 Resize the window below 1024px: confirm `MobileShell` takes over — canvas visible, bottom tab bar present, no content scrolled out of view.
- [ ] 9.3 Open each of the four tabs (`Page`, `Layout`, `Photos`, `Templates`) and confirm each shows the correct panel content, reads/writes the same store (e.g. change DPI in the `Page` sheet, resize back to desktop width, confirm `PageSetupPanel`'s desktop rendering shows the same value).
- [ ] 9.4 Select an image slot, a freeform element, and a library image: confirm the Properties sheet opens automatically each time and closes on deselect.
- [ ] 9.5 Switch to Nested mode in the `Layout` tab: confirm `LayoutTreePanel` appears in that sheet and divider dragging works the same as on desktop.
- [ ] 9.6 Confirm page navigation (prev/next/add page) works with no sheet open.
- [ ] 9.7 Resize back above 1024px mid-session (with a page loaded, an image assigned, a selection active): confirm `DesktopShell` takes back over cleanly with no lost state.

## 10. Android verification

- [ ] 10.1 Rebuild and reinstall on the Android emulator (`npm run build:android`, `./gradlew installDebug`).
- [ ] 10.2 Repeat the load-images → tap-to-assign → Properties-sheet-opens → Layout-tab/Nested-mode → page-navigation checks from section 9 on the real emulator, confirming touch interaction (not just mouse-driven resize testing) works the same way.
- [ ] 10.3 Confirm no console errors and no regression in the already-verified `android-shell` flows (Export PDF, Print, Save/Open via the `File` menu) now that they're triggered from inside `MobileShell`'s compact header instead of `DesktopShell`'s.

## 11. Spec closure

- [ ] 11.1 Run the full test suite and typecheck (desktop build must remain unaffected).
- [ ] 11.2 Run `openspec validate --strict --changes responsive-shell` and confirm it passes.
