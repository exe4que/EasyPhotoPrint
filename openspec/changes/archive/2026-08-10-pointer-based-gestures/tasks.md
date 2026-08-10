## 1. NodeDivider

- [x] 1.1 In `src/components/canvas/NodeDivider.tsx`, replaced `handleMouseDown`/`window.addEventListener('mousemove'/'mouseup', ...)` with `onPointerDown` calling `event.currentTarget.setPointerCapture(event.pointerId)`, plus `onPointerMove`/`onPointerUp`/`onPointerCancel` props on the same element. Active `pointerId` tracked in a ref; move/end events for any other `pointerId` are ignored.
- [x] 1.2 Kept the existing `locked`/`event.button !== 0` check unchanged — confirmed it already handles non-mouse pointer types correctly (touch/pen primary contact reports `button === 0` per the Pointer Events spec, so no adaptation was actually needed).
- [x] 1.3 Added `touch-none` (Tailwind's `touch-action: none` utility) to the divider's hit-area `div`.

## 2. FreeformElementView

- [x] 2.1 In `src/components/canvas/FreeformElement.tsx`, converted `startMoveDrag`/`startResizeDrag`/`startRotateDrag` to the pointer-capture pattern: each gesture gets its own `onPointerDown`/`onPointerMove`/`onPointerUp`/`onPointerCancel` quartet declared directly on its element (move body, resize handle, rotate handle), backed by its own ref holding that gesture's drag-start values (the React-idiomatic equivalent of the closures the old window-listener version captured per mousedown).
- [x] 2.2 Added `touch-none` to the move body, the resize handle, and the rotate handle.

## 3. Tap-to-assign

- [x] 3.1 In `src/components/canvas/PageStage.tsx`'s `imageSlot` click handler, added a branch on `selection?.kind === 'image'`: calls `assignImageToSlot(page.id, id, selection.id, 'library')` then `setSelection({ kind: 'node', id })` instead of the plain-selection branch; unchanged when no image is selected.
- [x] 3.2 In the `freeformCanvas` background `onClick` handler, added the same branch. Discovered mid-implementation that (unlike the slot drop path) the existing freeform drag-and-drop handler never calls `setSelection` at all, and `addFreeformElement` didn't return the id needed to select the newly placed element — so `documentSlice.ts`'s `addFreeformElement` now returns the shadow `imageSlot` node id it creates (was `void`), used here to `setSelection({ kind: 'node', id: newElementNodeId })`. Updated proposal.md/design.md to reflect this small, additive store change (the existing drag-and-drop call site is unaffected).
- [x] 3.3 Confirmed `createSlotDropProps`/`createPositionalDropProps` (HTML5 DnD) are untouched and still wired exactly as before — tap-to-assign is additive.

## 4. Verification

- [x] 4.1 Ran the full test suite and typecheck — 177/177 passing, no new automated tests (no component-test harness in this codebase; see design.md, Decision 4).
- [x] 4.2 Verified end-to-end in the running Electron app (Playwright `_electron` under xvfb, driving `page.mouse.down()/move()/up()`, which dispatches real trusted Pointer Events in Chromium per design.md's Decision 4):
  - Dragging a divider resized its siblings correctly (122.7px → 182.7px for a 60px drag), including dragging the pointer 60px past the divider's own 14px-wide hit area mid-drag — the resize tracked correctly throughout, confirming pointer capture (not the hit area) is what's keeping the drag alive.
  - Locked-divider skip logic was *not* re-verified via UI (no straightforward way to set a `fixedSizeMm` divider lock through the current UI within this scope) — it's unchanged code (`if (locked || event.button !== 0) return;`), carried over verbatim from the working mouse-events version, so this is a low-risk, deliberate scope call rather than an oversight.
  - Selecting a library image, then clicking an `imageSlot`, assigned it (visually confirmed: "SLOT-1 ASSIGNED" badge, thumbnail rendered) and moved selection to the slot; clicking a second slot afterward without re-selecting an image left it empty, confirming single-shot behavior.
  - Selecting a library image, then clicking an empty `freeformCanvas` area, placed a new element (screenshot-confirmed).
  - Freeform move (pointer drag from center, position changed as expected), resize (drag from the resize handle, width 60px → 92px), and rotate (drag from the rotate handle, `transform: rotate(0deg)` → `rotate(26.47deg)`, visually confirmed as a tilted rectangle in a screenshot) all worked via real pointer drags.
  - The existing HTML5 drag-and-drop path was *not* re-driven in this E2E pass (simulating real `dataTransfer`-based DnD reliably in Playwright is its own significant undertaking) — confirmed instead by direct code reading (task 3.3) that `createSlotDropProps`/`createPositionalDropProps` and their JSX wiring are byte-for-byte unchanged; the new tap-to-assign branches are additive `if` checks ahead of the existing logic, never touching it.
- [x] 4.3 Ran `openspec validate --strict --changes pointer-based-gestures` — passes.
