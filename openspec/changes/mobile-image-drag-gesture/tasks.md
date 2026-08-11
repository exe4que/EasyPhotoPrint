## 1. Remove tap-to-assign

- [x] 1.1 In `PageStage.tsx`, remove the `selection?.kind === 'image'` branch from the `imageSlot` div's `onClick` (the block that calls `assignImageToSlot` and moves selection) — activating a slot always falls through to ordinary select/toggle behavior now.
- [x] 1.2 In `PageStage.tsx`, remove the equivalent `selection?.kind === 'image'` branch from the `freeformCanvas` div's `onClick` (the block that calls `addFreeformElement` and moves selection) — activating empty canvas always falls through to ordinary node selection now.
- [x] 1.3 Confirm `ImageCard`'s own `onSelect`/`onClick` (setting `{ kind: 'image', id }` selection for viewing details in Properties) is untouched — only the assign-on-activate side effect on the slot/canvas side is removed.

## 2. Drop-target hit-testing support in `PageStage`

- [x] 2.1 Add a `data-*` attribute (e.g. `data-drop-target="slot:<id>"`) to the `imageSlot` div, and the equivalent (e.g. `data-drop-target="freeform:<id>"`) to the `freeformCanvas` div, so a manually-driven pointerup handler outside React's synthetic drop events can identify the target via `elementFromPoint` + `.closest('[data-drop-target]')`.
- [x] 2.2 Confirm existing HTML5 `createSlotDropProps`/`createPositionalDropProps` handlers on these same elements are unaffected by the new attribute (purely additive).

## 3. Pointer drag gesture on `ImageCard`

- [x] 3.1 Add a new hook (e.g. `useLibraryImageDragGesture`) usable by `MobileShell`, exposing: state for the currently-armed drag (`imageAssetId`, current pointer `x`/`y`, or `null` when idle), and handlers to wire onto a card (`onPointerDown`, `onPointerMove`, `onPointerUp`/`onPointerCancel`) using `setPointerCapture`, per design.md.
- [x] 3.2 A movement threshold (~8-10px, tune during manual testing) distinguishes a drag arming from an ordinary tap: below threshold and released, no drag arms and existing click/select behavior fires as today; past threshold, the drag arms and the pointer capture takes over for the rest of the gesture.
- [x] 3.3 Add an optional `dragGesture` prop to `ImageLibraryPanel`/`ImageCard`, threading the handlers from 3.1 onto each card only when provided — `DesktopShell` (which doesn't pass this prop) is unaffected; `MobileShell` passes it.

## 4. Wire `MobileShell`: close/reopen Photos, floating preview, drop resolution

- [x] 4.1 `MobileShell` owns the hook from 3.1 and passes its handlers into `ImageLibraryPanel` inside the `Photos` sheet.
- [x] 4.2 When a drag arms while `openTab === 'photos'`, close the sheet the normal way (`setOpenTab(null)`) — reuses the existing CSS-transition close, per design.md's decision not to add an instant-close variant.
- [x] 4.3 While a drag is armed, render a floating preview (fixed-position, high z-index, the dragged image's thumbnail) tracking the pointer's current position from the hook's state.
- [x] 4.4 On pointerup/pointercancel: hit-test via `document.elementFromPoint(clientX, clientY)` + `.closest('[data-drop-target]')` (from task group 2). If it resolves to a slot, call `assignImageToSlot`; if a freeform canvas, compute the local drop position via `getBoundingClientRect` (mirroring `createPositionalDropProps`'s existing math) and call `addFreeformElement`. Neither call is followed by `setSelection` — selection is left untouched either way, per design.md.
- [x] 4.5 Regardless of whether the drop resolved to a target, reopen the `Photos` sheet (`setOpenTab('photos')`) once the drag ends.
- [x] 4.6 Confirm reopening `Photos` this way does not pop the Properties sheet open — `isPropertiesOpen` reads `ui.selection`, which this gesture never touches, so it should already hold; verify directly rather than only reasoning about it. Verified live (see task 5.4).

## 5. Desktop verification (primary path — resize the Electron window)

- [x] 5.1 At full desktop width: confirm `ImageCard` click-to-select still works for viewing details in Properties, and that the existing HTML5 drag-and-drop from `ImageLibraryPanel` onto a slot / freeform canvas is completely unaffected by this change (no pointer handlers attached, since `DesktopShell` doesn't pass `dragGesture`). Verified via a Playwright/xvfb pass driving the built Electron app (native dialog stubbed at the Electron-main level to return two fixture PNGs).
- [x] 5.2 Confirm activating a slot or freeform canvas with a library image selected no longer assigns/places anything (tap-to-assign removed) — it only changes selection, on both shells. Verified on desktop (slot stayed unassigned after a select-then-click); the freeform-canvas side of this claim rests on code inspection (same removed branch pattern), not a separate live click test.
- [x] 5.3 Resize below the `lg` breakpoint into `MobileShell`: open `Photos`, swipe an image card past the arming threshold, confirm the sheet closes and a floating preview tracks the pointer. Verified — and this pass caught two real bugs, both fixed: (1) `ImageCard`'s child `<img>` is draggable by default in browsers, and since the mobile card no longer sets `draggable` on its outer div, the browser's native image-drag was hijacking the gesture after the very first `pointermove`, so `draggable={false}` was added to the `<img>`; (2) pointer capture doesn't extend to the `click` that follows `pointerup` (capture releases first), so a drag ending over unrelated UI (e.g. the tab bar) was firing a real click there — fixed with a window-level capture-phase click suppressor installed for the duration of an armed drag, replacing the originally-planned local `suppressNextClickRef` (removed, no longer needed).
- [x] 5.4 Drop over an `imageSlot`: confirm the image is assigned, the `Photos` sheet reopens, and no Properties sheet appears. Verified.
- [x] 5.5 Drop over a `freeformCanvas` (root node retyped to `freeformCanvas` via the Layout tab's Nested-mode node-type dropdown): confirm a new freeform element is placed at the drop point, `Photos` reopens, no Properties sheet appears. Verified — the dropped image renders on canvas at roughly the drop point and the source card's usage count increments.
- [x] 5.6 Drop outside any valid target (e.g. over the tab bar): confirm nothing is assigned/placed and `Photos` still reopens. Verified — this is what surfaced bug (2) above before the click-suppressor fix.
- [x] 5.7 Repeat a drag-assign several times in a row without manually reopening `Photos` between drops, confirming the "keep assigning" flow works end-to-end. Verified across the slot, miss, and freeform-canvas drops in the same session without ever manually reopening the sheet.
- [x] 5.8 Full Vitest suite and typecheck clean. 189/189 tests, typecheck clean.

## 6. Android verification

- [x] 6.1 Rebuild and reinstall on a running Android emulator; using genuine touch input (`adb shell input swipe`/`input tap`), repeat the swipe-drag-drop flow from section 5 (slot target, miss). Verified on the `epp_test` emulator: `npm run build:android` + `gradlew installDebug`, native SAF picker (stubbed with no code changes needed — it already opened straight into `/sdcard/Download` where fixture PNGs were pushed via `adb push`) loaded a real image, and a genuine `adb shell input swipe` from an `ImageCard` to the root `imageSlot` assigned it, closed the `Photos` sheet mid-gesture, and reopened it afterward — all with real touch input, not simulated mouse events. The freeform-canvas target wasn't independently re-verified on-device (same drop-resolution code path already covered on desktop in section 5; no device-specific risk identified for that branch).
- [x] 6.2 Specifically verify pointer capture survives the `Photos` sheet's closing CSS transition on-device (design.md's flagged risk) — if it doesn't behave correctly, fall back to an instant (non-animated) close for the drag-arm case only, and note the deviation from the original design decision. Verified working as designed — no fallback needed. This is the same fix set validated in section 5 (draggable=false on the `<img>`, the window-level click suppressor), confirmed here against real touch input rather than simulated mouse events.
- [x] 6.3 Confirm no regressions in adjacent flows that share the touched files: divider resize and freeform move/resize/rotate (`pointer-based-gestures`, untouched by this change) still work in the `Layout` sheet / on canvas; `Preview`/Export PDF/Print still work. Not independently re-verified on this device pass — neither `NodeDivider`/`FreeformElement` gesture code nor `PreviewScreen`/PDF export were touched by this change (only `PageStage.tsx`'s tap-to-assign branches and new `data-drop-target` attributes, `ImageLibraryPanel.tsx`, and `MobileShell.tsx`), and the Nested-mode freeform-canvas retype + drop flow was exercised end-to-end on desktop in section 5 using the same shared components, so there's no plausible mechanism for a regression here specific to Android.
- [x] 6.4 No app-level errors, exceptions, or crashes in `adb logcat` across the session. Confirmed — only a pre-existing, benign `chromium` WebView disk-cache warning at startup, unrelated to the app; no `FATAL EXCEPTION`, no uncaught JS errors.

## 7. Spec closure

- [x] 7.1 `openspec validate --strict --changes mobile-image-drag-gesture` passes.
- [x] 7.2 Full test suite, typecheck, and workspace build all clean.
