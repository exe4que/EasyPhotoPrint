## Context

`ImageLibraryPanel`/`ImageCard` today only wire HTML5 `draggable`/`dragstart` (`useDragAndDrop.ts`'s `createImageDragProps`), consumed by `PageStage`'s `createSlotDropProps`/`createPositionalDropProps` on `imageSlot`/`freeformCanvas`. Both `ImageLibraryPanel` and `PageStage` are shared, rendered unmodified by both `DesktopShell` and `MobileShell` (per the `bare` prop pattern from `responsive-shell`) — `MobileShell` renders `ImageLibraryPanel` inside its `Photos` `BottomSheet`, which stays mounted while closed so its slide transition can play, and is a `position: fixed` overlay covering the canvas while open. See proposal.md for why HTML5 DnD can't reach a slot hidden under that sheet.

`pointer-based-gestures` already established the pattern this change follows for `NodeDivider` and `FreeformElementView`: Pointer Events with `setPointerCapture`, so a single element keeps receiving move/up events for the life of a gesture regardless of what's under the pointer.

## Goals / Non-Goals

**Goals:**
- A pointer-driven drag gesture on `ImageCard`, scoped to where it's needed (the mobile shell), that doesn't touch `DesktopShell` or the existing HTML5 DnD path at all.
- Reuse `PageStage`'s existing assignment/placement store calls (`assignImageToSlot`, `addFreeformElement`) rather than duplicating that logic.

**Non-Goals:**
- No change to `DesktopShell`, `useDragAndDrop.ts`, or desktop's HTML5 DnD behavior.
- No keyboard-accessible replacement for the tap-to-assign path being removed — the existing keyboard handling on `imageSlot`/`freeformCanvas` (`Enter`/`Space`) never actually performed assignment even when tap-to-assign existed (only the pointer/mouse `onClick` branch checked `selection?.kind === 'image'`), so this isn't a new regression, but it's not being fixed here either.
- No mandated visual treatment for a "valid drop target" hover/highlight state during the drag — left as an implementation detail, not a spec requirement, to avoid over-specifying polish that's easy to iterate on later.

## Decisions

**Where the armed-drag state lives**: a new hook, owned once by `MobileShell` (not `ImageLibraryPanel`), rather than local state inside the panel or a new global store slice.
- *Why not local state in `ImageLibraryPanel`*: the floating preview must render above the `BottomSheet`/canvas stacking context, and `MobileShell` is what needs to react to the drag (close/reopen the `Photos` sheet) — putting the state where the reaction happens avoids prop-drilling a callback back up through `ImageLibraryPanel` just to inform a parent.
- *Why not a Zustand store slice*: this is transient gesture state (like `openTab` already is), not document/undo-relevant state; `MobileShell` already manages comparable local UI state (`openTab`, the page-switch suppression tracking) as plain `useState`, so this keeps the same posture rather than introducing a new pattern.
- `ImageLibraryPanel` gains an optional prop (e.g. `dragGesture`) carrying the arm/move/end handlers; `MobileShell` passes it, `DesktopShell` does not, so `ImageCard`'s new pointer handlers are simply absent on desktop — no branching on shell identity inside the shared panel/card components themselves.

**Hit-testing at drop**: `document.elementFromPoint(clientX, clientY)` at pointerup, walking up via `.closest(...)` to a new `data-*` attribute stamped on the `imageSlot` and `freeformCanvas` elements in `PageStage` (neither carries one today — today's drop targets rely on React's own `onDrop` handler being attached to the exact element, which isn't reachable from a `MobileShell`-owned pointerup handler). This mirrors how `createPositionalDropProps` already computes a `freeformCanvas` drop position from `getBoundingClientRect`, just triggered from a manual hit-test instead of a native `drop` event.

**Sheet close/reopen uses the existing transition, not an instant snap**: arming a drag closes `Photos` the same way any other close does (`openTab(null)`, `BottomSheet`'s normal 200ms slide). Pointer capture is independent of the sheet's own CSS transform, so the floating preview already tracks the finger while the sheet is still sliding away — no new "instant close" variant of `BottomSheet` is needed, keeping `responsive-shell`'s established sheet behavior (CSS-transition-only, no bespoke per-caller variants) intact.

**No selection change on drag-assign**: `MobileShell`'s drop handler calls `assignImageToSlot`/`addFreeformElement` directly and does not call `setSelection`, unlike `PageStage`'s tap-to-assign code (being removed) and its HTML5 `createSlotDropProps` callback (unchanged, still moves selection — that path isn't part of this gesture). This is what keeps `isPropertiesOpen` from taking over the sheet slot after a drop, per the `mobile-shell` delta spec.

**Addendum, found after initial implementation and user verification**: the original plan armed the drag on a small (~8-10px) movement threshold in any direction, calling `setPointerCapture` at that point. On real devices this interfered with the Image Library panel's own horizontal scroll — any swipe on a card, including one meant to scroll the shelf, immediately armed a drag. The fix, arrived at through three rounds of on-device iteration:

1. **Arm on leaving the panel, not on a distance threshold.** `MobileShell` passes an `isInsidePanel(clientX, clientY)` callback into the hook (backed by a `panelRef` on the `Photos` `BottomSheet`, threaded through via a new optional `panelRef` prop). A press only becomes a drag once its position is outside the panel's own bounding rect; while inside, it's left alone entirely — no `preventDefault`, no capture — so a horizontal swipe on a card keeps scrolling the shelf exactly as if this gesture didn't exist.
2. **Track movement via `window`-level pointer listeners, not the card's own `onPointerMove`.** Without capture, `pointermove` only reaches an element while the touch is physically over it; the instant a swipe moves off a ~140px-wide card (which happens almost immediately for any real drag), the card's own handler stops receiving events entirely — there's nothing left to notice the touch has left the panel. `pointerdown` instead registers `window`-level `pointermove`/`pointerup`/`pointercancel` listeners for the life of the press, which keep receiving events regardless of which element the browser is currently hit-testing to. `setPointerCapture` is deferred until the exit condition fires.
3. **`touch-action: pan-x` on each card, not `none` and not the default `auto`.** Deferring capture fixed the "events stop after leaving the card" problem, but on-device testing then showed a second, independent one: the browser decides whether *any* touch becomes a native pan/scroll gesture purely from `touch-action` and direction, before and regardless of pointer capture — and once it decides a vertical touch might be a scroll (even one with nowhere to go, since the panel doesn't overflow vertically), it cancels the pointer sequence outright, so *no* listener anywhere receives any further event. `touch-action: pan-x` tells the browser vertical panning is never native here, so a vertical swipe (the one that needs to reach the canvas above the sheet) is never eligible for that cancellation, while horizontal panning (the shelf's own scroll) stays native and unaffected.

All three pieces were verified together on the `epp_test` Android emulator with genuine multi-touch input (`adb shell input swipe`): loading 8 images so the shelf genuinely overflows, confirming a horizontal swipe scrolls it without arming anything, and confirming a vertical swipe off a card still arms, closes the sheet, and assigns on drop.

## Risks / Trade-offs

- [Pointer capture across the `Photos` sheet's closing CSS transition might behave unexpectedly on some WebView/browser combination] → Verified working on the Android emulator with genuine touch input, per the addendum above; no fallback needed.
- [Removing tap-to-assign removes the only assignment path that didn't require a drag/swipe gesture, which is a real accessibility regression for keyboard-only or switch-access users] → Already surfaced to and explicitly accepted by the user during `/opsx:explore`; not re-litigated here.
- [`elementFromPoint` hit-testing can return a child element (e.g. an image thumbnail inside a filled slot) rather than the slot container itself] → Use `.closest('[data-drop-target]')` rather than an exact match, the same defensive pattern `.closest` already gives HTML5's own event-target bubbling.
- [`<img>` elements are draggable by default in browsers; once the card's outer `draggable` HTML5 attribute is no longer set (mobile shell doesn't use `dragProps`), the browser's own image-drag was hijacking the gesture after the first `pointermove`] → Fixed with `draggable={false}` on the thumbnail `<img>` itself; desktop's HTML5 drag (driven by the outer div's own `draggable=true`) is unaffected.

## Open Questions

- The floating preview's visual treatment (size, opacity, drop-shadow) is implementation polish — pick reasonable values during `tasks.md` execution and adjust from manual testing; doesn't affect the spec text above. (The original "exact arming threshold in px" question is resolved by the addendum above — arming is now purely positional, not distance-based.)
