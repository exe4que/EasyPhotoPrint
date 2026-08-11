## Why

Dragging a library image onto a slot never reliably worked over touch — `useDragAndDrop.ts` is plain HTML5 drag-and-drop, which most touch browsers/WebViews don't fire for touch input (the `responsive-shell` change's own Android verification had to avoid simulating HTML5 drag on the emulator for exactly this reason). `canvas-interaction`'s tap-to-assign requirement papered over that gap. Now that `mobile-shell` puts the image library behind a `Photos` bottom sheet that covers the canvas, the gap is worse: even a working HTML5 drag couldn't reach a slot hidden under the sheet. The app needs a real touch-drag gesture for this specific path, following the Pointer Events pattern `pointer-based-gestures` already established for every other canvas gesture (divider resize, freeform move/resize/rotate) instead of relying on HTML5 DnD or the tap workaround.

## What Changes

- Add a Pointer Events-based drag gesture on `ImageCard` (Image Library panel): a press arms as a drag only once its position moves outside the Image Library panel's own bounds; a press that stays inside the panel is left alone entirely (the panel's own horizontal scroll, or an ordinary tap, keeps working exactly as it does today). A floating thumbnail overlay tracks the pointer for the rest of an armed gesture.
- In the mobile shell specifically, arming this drag closes the open `Photos` bottom sheet so the canvas underneath becomes reachable; releasing the pointer over an `imageSlot` assigns the image there, or over a `freeformCanvas` places it as a new freeform element at the drop point (mirroring desktop's positional HTML5 drop); releasing anywhere else does neither. Either way, the `Photos` sheet reopens afterward so the user can keep assigning without re-opening it.
- Unlike tap-to-assign, a successful drag-assign does **not** move the selection to the newly assigned node — this is what lets the `Photos` sheet reopen instead of `mobile-shell`'s Properties auto-sheet taking over after every drop.
- **BREAKING**: Removes tap-to-assign entirely, in every shell — selecting a library image and then activating (click/tap) an `imageSlot` or `freeformCanvas` no longer assigns/places it; it falls back to ordinary node-selection behavior. Selecting a library image to view its details in the Properties panel is unaffected — only the assign-on-activate side effect goes away. On desktop, this leaves the existing HTML5 drag-and-drop as the only mouse-driven way to assign an image (no more click-select-then-click-slot alternative); the new pointer-gesture drag is mobile-shell-specific and does not extend to `DesktopShell`, which has no sheet to close/reopen around the canvas.

## Capabilities

### Modified Capabilities
- `canvas-interaction`: Removes the "Tap-to-Assign Is an Alternative to Drag-and-Drop" requirement (all 4 scenarios) and adds a new requirement for the Pointer Events-based library-image drag gesture (arms only once the press leaves the Image Library panel, floating preview, drop resolution against `imageSlot`/`freeformCanvas`, no selection change on assign).
- `mobile-shell`: Adds a requirement for how the `Photos` bottom sheet interacts with an in-progress library-image drag — closing while armed, reopening after the drop resolves (assigned or not).

## Impact

- `src/hooks/useLibraryImageDragGesture.ts` (new): owns the gesture's session state and the panel-exit arming logic; see design.md for why it tracks movement via `window`-level pointer listeners rather than the card's own `onPointerMove`, and why pointer capture is deferred until arming.
- `src/components/panels/ImageLibraryPanel.tsx`: `ImageCard` gains an optional `dragGesture` prop wiring `onPointerDown` from the hook above (replacing `dragProps`, HTML5 `draggable`, only when provided — desktop keeps `dragProps`); its thumbnail `<img>` gets `draggable={false}` (browsers make `<img>` draggable by default, which otherwise hijacks the gesture) and the card gets `touch-action: pan-x` (see design.md) when the gesture is active.
- `src/components/canvas/PageStage.tsx`: remove the `selection?.kind === 'image'` tap-to-assign branches in both the `imageSlot` `onClick` and the `freeformCanvas` `onClick`; add `data-drop-target` attributes to both so the new drag gesture can resolve a drop via `elementFromPoint`, then call the existing `assignImageToSlot`/`addFreeformElement` store actions directly, the same way the current drop handlers do.
- `src/components/shell/MobileShell.tsx`: owns the drag hook, force-closes the `Photos` sheet on arm and reopens it after the drop (independent of the existing `openTab`/Properties-auto-sheet state machine), and renders the floating preview. Passes a `panelRef` into the `Photos` `BottomSheet` so the hook can tell when a press has left the panel.
- `src/components/shell/BottomSheet.tsx`: gains an optional `panelRef` prop (forwarded to the sheet's own outer element) — additive, every other sheet omits it.
- `src/hooks/useDragAndDrop.ts`: unchanged (desktop HTML5 DnD keeps working as-is); the new gesture is a separate mechanism, not a replacement.
- No changes to `packages/layout-engine`, `electron/**`, `android/**`, or any platform adapter.
