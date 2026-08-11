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

## Risks / Trade-offs

- [Pointer capture across the `Photos` sheet's closing CSS transition might behave unexpectedly on some WebView/browser combination — capture is element-bound, not visibility-bound, but this hasn't been verified against Capacitor's Android WebView specifically] → Verify manually on the Android emulator during implementation, the same way `responsive-shell` and `pointer-based-gestures` both did for their own gestures; fall back to an instant (non-animated) close for the drag-arm case specifically if capture proves unreliable mid-transition.
- [Removing tap-to-assign removes the only assignment path that didn't require a drag/swipe gesture, which is a real accessibility regression for keyboard-only or switch-access users] → Already surfaced to and explicitly accepted by the user during `/opsx:explore`; not re-litigated here.
- [`elementFromPoint` hit-testing can return a child element (e.g. an image thumbnail inside a filled slot) rather than the slot container itself] → Use `.closest('[data-drop-target]')` rather than an exact match, the same defensive pattern `.closest` already gives HTML5's own event-target bubbling.

## Open Questions

- Exact arming threshold (~8-10px suggested in proposal.md) and the floating preview's visual treatment (size, opacity, drop-shadow) are implementation polish — pick reasonable values during `tasks.md` execution and adjust from manual testing; neither affects the spec text above.
