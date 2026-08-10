## Context

Three interaction surfaces exist on the canvas today, and only one of them is remotely touch-compatible:

- `NodeDivider` and `FreeformElementView` both implement dragging with `onMouseDown` starting a manual `window.addEventListener('mousemove'/'mouseup', ...)` pair, torn down on mouseup. Touch never fires `mousedown`/`mousemove`/`mouseup` in a WebView, so these are silently inert under touch — not degraded, absent.
- Assigning an image to a slot goes through HTML5 drag-and-drop (`useDragAndDrop.ts`), which has no touch equivalent at all.
- Clicking (not dragging) already works everywhere — `onClick` fires correctly for both mouse and touch input in every target environment — which is why selecting an image card, selecting a slot, and selecting a freeform element all already work regardless of input device. `ui.selection`'s `{ kind: 'image', id }` variant, set by `ImageLibraryPanel`'s existing `onSelect`, is exactly the "armed image" state a tap-to-assign flow needs, and it already exists for an unrelated reason (showing image details in the Properties panel).

See proposal.md - Why for the broader motivation.

## Goals / Non-Goals

**Goals:**
- Every continuous drag gesture on the canvas (divider resize, freeform move/resize/rotate) works identically for mouse, touch, and pen input.
- Assigning an image to a slot or freeform canvas is possible without a drag gesture, without touching the existing HTML5 DnD path at all.
- Zero new store state, zero new IPC, zero changes to `project-persistence`'s assignment semantics.

**Non-Goals:**
- Not replacing HTML5 drag-and-drop — it stays as the desktop-mouse path exactly as it is.
- Not adding a "drag an image via touch" gesture — tap-to-assign is the touch-equivalent action, not a touch reimplementation of drag-and-drop. A future change can revisit this if it turns out to matter.
- Not building or introducing a component-test framework. This codebase has none today (every existing test is pure-logic `.test.ts`), and standing one up is a materially larger, separate decision than a gesture migration.
- Not touching pan/zoom — `activeTool: 'pan'` exists in the store but nothing currently reads it; panning today is just native scroll on the `overflow-auto` viewport, which this change doesn't touch.

## Decisions

### 1. Pointer capture replaces window listeners, not just mouse events replaced 1:1

Each drag start (`onPointerDown`) calls `event.currentTarget.setPointerCapture(event.pointerId)` and attaches `onPointerMove`/`onPointerUp`/`onPointerCancel` as ordinary React props on the same element — no `window.addEventListener` at all. Pointer capture guarantees every subsequent event for that `pointerId` keeps routing to the capturing element regardless of where the pointer physically moves (even off-screen), which is exactly what the manual `window` listeners were working around today, more robustly: a captured drag can never "escape" its element, where today's implementation is already relying on a `window`-level fallback because plain element-level mouse events wouldn't survive the pointer leaving the small divider hit-area.

This is a genuine simplification, not just a rename: each of the six drag handlers (divider resize, freeform move/resize/rotate ×1 each — wait, three on FreeformElementView, one on NodeDivider) drops its `window.addEventListener`/`removeListener` pair entirely.

A `pointerId` is tracked per gesture (a ref, not state) so a second finger touching mid-drag is ignored rather than corrupting the active drag — multi-touch on a single divider/handle was never a supported interaction and shouldn't become one by accident.

### 2. `touch-action: none` scoped to the interactive handles only

Applied to `NodeDivider`'s hit-area `div` and to `FreeformElementView`'s move body / resize handle / rotate handle — not to any ancestor container. Touch-dragging a divider or a handle must not simultaneously scroll the page-preview viewport (the same conflict `touch-action: none` exists to solve everywhere); scoping it narrowly means the viewport's own native scroll-to-pan behavior (today's only "pan" implementation) is completely unaffected everywhere else on the canvas.

### 3. Tap-to-assign reuses existing selection state; it is additive, not a replacement

`PageStage.tsx`'s existing `imageSlot` click handler and `freeformCanvas` background click handler each gain one branch: when `ui.selection` is `{ kind: 'image', id }` at click time, call the same store actions the library-source drag path already calls (`assignImageToSlot(page.id, slotId, imageAssetId, 'library')` for a slot, `addFreeformElement(page.id, canvasId, imageAssetId)` — omitting a position, which the action already centers by default — for a freeform canvas) instead of the plain node-selection branch. When `ui.selection` is anything else, both handlers behave exactly as they do today.

Alternatives considered: a dedicated "assign mode" toggle, or a floating "Assign" button that appears when an image is selected. Both add new UI surface and new state for something the existing `{ kind: 'image' }` selection already models correctly — clicking a target while an image is selected reads as "put this here" without needing to be told so, and it costs nothing beyond two `if` branches in code that already runs on every slot/canvas click.

After assignment, selection moves to the target node (`{ kind: 'node', id }`), consuming the armed `{ kind: 'image' }` selection. This makes the gesture single-shot: assign once, selection lands on the result, and a second click elsewhere needs the user to re-select an image first rather than silently repeating the assignment — deliberately, rather than introducing an unfamiliar "stamp mode" (see Risks/Trade-offs).

For the slot case this exactly mirrors what the drag-and-drop path already does today (`PageStage.tsx`'s slot drop handler calls `setSelection` before `assignImageToSlot`). The freeform-canvas case doesn't have an equivalent precedent to mirror — the existing positional-drop handler for dragging an image onto a `freeformCanvas` doesn't change selection at all today. Selecting the *newly placed element* (not just the canvas) is still the right call here: it's what lets the user immediately see/adjust the element they just placed in the Properties panel, and leaving selection on the canvas (or unchanged) wouldn't consume the armed image selection in a way that reads as "done." Doing this needs the id of the shadow `imageSlot` node `addFreeformElement` creates internally, so that action's return type changes from `void` to that id (a small, additive, backward-compatible store change — the existing drag-and-drop call site keeps working unchanged, simply not using the new return value).

### 4. Verification is E2E-only, and that's sufficient here

Playwright's `page.mouse.down()/move()/up()` sequence in a real Chromium/Electron window dispatches genuine, trusted Pointer Events (`pointerdown`/`pointermove`/`pointerup` with `pointerType: 'mouse'`) as a side effect of real mouse input — Chromium always fires Pointer Events alongside Mouse Events for real input, unlike a jsdom-based unit test which fires neither realistically. So driving these gestures with Playwright's mouse API in the existing manual E2E recipe exercises the actual new code path (`onPointerDown`, `setPointerCapture`, the capture-scoped move/up handlers) with trusted events, not a synthetic approximation — this is a meaningfully stronger signal than a unit test with hand-constructed event objects would be, and it's what this change relies on instead of introducing React Testing Library or similar.

What it doesn't prove: that a *real touch* pointer (`pointerType: 'touch'`) behaves identically on an actual Android WebView. Playwright's `touchscreen.tap()` covers a tap (sufficient for tap-to-assign, which is just an `onClick`), but there's no clean built-in "touch drag" simulation for the divider/freeform gestures. That gap is deliberately left for the Android phase later in this plan, where it can be checked against the real target — this change's job is only to prove the mouse-driven regression bar holds and that the implementation is input-agnostic by construction (Pointer Events, not mouse-specific APIs).

## Risks / Trade-offs

- [Pointer capture is unfamiliar relative to the codebase's existing window-listener pattern] → Mitigated by it being strictly simpler (fewer lines, no manual add/remove pairing to get wrong) once written once as the reference implementation (the divider); the three freeform handlers follow the same shape.
- [Actual touch-drag behavior (divider/freeform handles) isn't verified until a real Android WebView exists] → Accepted per Decision 4; the code is written to the platform-agnostic Pointer Events API specifically so there's no reason to expect divergence, but this is a real gap being named rather than papered over.
- [Tap-to-assign's single-shot behavior (selection consumed after one assignment) might feel limiting for someone placing the same image on many slots] → A deliberate, reversible choice (Decision 3); if it turns out to matter, re-arming selection after assignment is a small follow-up, not a redesign.
