## Why

None of the canvas's continuous drag gestures work with a finger today. `NodeDivider` (resizing a horizontal/vertical container) and `FreeformElementView` (moving, resizing, rotating a freeform element) are all built on `onMouseDown` plus `window.addEventListener('mousemove'/'mouseup', ...)` — events that simply never fire for touch input. Assigning an image to a slot is worse: it goes through HTML5 drag-and-drop (`useDragAndDrop.ts`'s `draggable`/`dataTransfer`), and HTML5 DnD has no touch equivalent at all in a mobile WebView — not degraded, entirely absent.

This is the second of the desktop-verifiable phases toward running the same renderer on Android (see the earlier `extract-platform-adapter` and `packaged-project-files` changes). It stands on its own regardless of Android: Pointer Events with capture is strictly more robust than the current window-listener pattern even for mouse-only use (a drag that's captured never "loses" the pointer if it briefly leaves the element's bounding box), so this is a real desktop improvement, not a mobile-only patch bolted on.

## What Changes

- `NodeDivider` and `FreeformElementView` switch from `onMouseDown` + manual `window` mouse listeners to the Pointer Events API (`onPointerDown`/`onPointerMove`/`onPointerUp`/`onPointerCancel`) with `setPointerCapture`. Once a divider or a move/resize/rotate handle captures a pointer, every subsequent event for that pointer — mouse, touch, or pen — keeps routing to that same element regardless of where the pointer physically moves, so the manual `window` listener add/remove pair is no longer needed at all.
- Interactive handles (`NodeDivider`, and `FreeformElementView`'s move/resize/rotate handles) get `touch-action: none` so a touch-drag on them doesn't simultaneously scroll the page-preview viewport.
- A tap-to-assign path is added alongside — not instead of — the existing HTML5 drag-and-drop: selecting a library image (the existing `ui.selection` state already has a `{ kind: 'image', id }` variant, set today when a user clicks an Image Library card) and then clicking/tapping an `imageSlot` or an empty area of a `freeformCanvas` assigns that image there, the same way dropping it from the library would. This needs no new gesture handling — `onClick` already fires correctly for a touch tap in every target environment — only new branching in the slot/canvas click handlers that already exist in `PageStage.tsx`.
- Explicitly unchanged: the HTML5 drag-and-drop path (`useDragAndDrop.ts`) stays exactly as it is for desktop mouse users; the underlying assignment logic (`assignImageToSlot`, `addFreeformElement`) is invoked identically regardless of which input path triggered it, so none of `project-persistence`'s assignment-semantics requirements (replace-by-default, swap-on-page-source, images-not-exclusive) change at all.

Explicitly out of scope: no UI redesign, no mobile shell, no Capacitor/Android code. Verifiable entirely on desktop — a captured pointer behaves identically for a mouse, and tap-to-assign is exercised with an ordinary click.

## Capabilities

### New Capabilities

- `canvas-interaction`: how pointer input (mouse, touch, pen) drives direct-manipulation gestures on the canvas — divider resizing, freeform element move/resize/rotate, and the tap-based alternative to drag-and-drop for assigning an image — so every canvas interaction works the same way on a touchscreen as it does with a mouse.

### Modified Capabilities

(none — `project-persistence`'s assignment-logic requirements are invoked unchanged by the new input path; no requirement in that capability describes *how* an assignment is triggered, only what happens once it is)

## Impact

- `src/components/canvas/NodeDivider.tsx`: `handleMouseDown` + `window` listeners → `onPointerDown`/`onPointerMove`/`onPointerUp`/`onPointerCancel` with `setPointerCapture`; `touch-action: none` added to the divider's hit-area element.
- `src/components/canvas/FreeformElement.tsx`: `startMoveDrag`/`startResizeDrag`/`startRotateDrag` and their `window` listeners → the same pointer-capture pattern; `touch-action: none` added to the move handle (the element's own body) and the resize/rotate handles.
- `src/components/canvas/PageStage.tsx`: the existing `imageSlot` click handler and the existing `freeformCanvas` background click handler both gain a branch — when `ui.selection` is `{ kind: 'image' }` at click time, assign/place that image instead of (or in addition to, per the exact scenario) the current node-selection behavior. `createSlotDropProps`/`createPositionalDropProps` (HTML5 DnD) stay wired exactly as they are today.
- No changes to `useDragAndDrop.ts`, `ImageLibraryPanel.tsx` (its existing `onSelect` already sets `{ kind: 'image', id }` — nothing new needed there), `Selection`'s type (its `'image'` variant already exists), `packages/layout-engine`, or any IPC/platform-adapter surface. One small, additive store change: `documentSlice.ts`'s `addFreeformElement` starts returning the id of the shadow `imageSlot` node it creates (previously `void`) — needed so tap-to-place can select the newly placed element afterward, the same way tap-to-assign-to-a-slot already can via the slot's own id. The existing drag-and-drop call site keeps working unchanged; it simply doesn't use the new return value.
- No new automated component tests: this codebase has no component-level test harness today (only pure-logic `.test.ts` files) and introducing one is out of scope for a gesture migration. Verification is the established manual Electron E2E recipe (Playwright `_electron` under xvfb), which can drive pointer events directly.
