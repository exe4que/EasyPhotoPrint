## Context

`PageStage` (`src/components/canvas/PageStage.tsx`) renders three DOM layers relevant here: the scrollable `viewportRef` container (the gray background, can be larger than the page when zoomed out or the panel is wide), a centering wrapper, and the page rectangle itself (`bg-white`, fixed `previewWidthPx`/`previewHeightPx`). Inside the page rectangle, `grid`/`horizontal`/`vertical` container gaps, `imageSlot`s, `freeformCanvas`es, and dividers each already own a click handler; the root's padding band (drawn only as a `pointer-events-none` dashed-outline `<div>` starting exactly at the padding offset) and everything in `viewportRef` outside the page rectangle currently have no handler at all. See proposal.md - Why/What Changes for the user-facing behavior; see the `canvas-interaction` delta spec for the exact scenarios this must satisfy, including the two explicit exclusions (inter-slot gaps, freeform canvas empty-area tap).

## Goals / Non-Goals

**Goals:**
- Make the root's margin band and the viewport background outside the page rectangle activatable, selecting the root node.
- Do this without adding any handler (or behavior change) to inter-slot gap space inside `grid`/`horizontal`/`vertical` containers, or to `freeformCanvas`'s existing empty-area tap.

**Non-Goals:**
- Introducing any mobile-specific shell or Properties presentation. `main` has no separate mobile shell yet — the Electron desktop build and the Android build (`main.android.tsx`) both render the same `App`/`PageStage`, with Properties always shown in the sidebar. (`responsive-shell`, which adds `MobileShell`/`DesktopShell` and a Properties bottom sheet, is a separate, still-unmerged change — this change doesn't depend on it and reaches Android automatically once it's ordinary `PageStage` behavior.)
- Changing the tap-to-assign armed-image behavior for `imageSlot`/`freeformCanvas` (unchanged, still spec'd in `canvas-interaction`'s existing "Tap-to-Assign" requirement).

## Decisions

**Single geometric click handler on the page rectangle + viewport, not per-region elements.** Rather than turning the margin-band outline `<div>` into a real `pointer-events-auto` element (which would need its own separate handler plus one more for the viewport background), one `onClick` on the outer page-rectangle `<div>` and one on `viewportRef` compute the click position relative to the page rectangle (`getBoundingClientRect`) and branch on where it falls:
- Outside the page rectangle's own bounds (caught by the `viewportRef` handler, since the page rectangle is a descendant and would otherwise swallow in-bounds clicks) → select root.
- Inside the page rectangle but outside the root's padded content box (margin band) → select root.
- Inside the root's padded content box → no-op; whatever's actually there (a slot, a container gap, a freeform canvas, a divider) already owns that space, either via its own handler or, for gaps, deliberately via no handler at all (per the spec's exclusion scenario).

This keeps the change to two `onClick` handlers with a bounds check, instead of introducing new DOM elements or changing `pointer-events` on the existing outline. Alternative considered: give the outline `<div>` `pointer-events-auto` and its own `onClick`. Rejected because it only covers the margin band, not the outside-page-bounds case, so the viewport-level handler would be needed anyway — better to compute both from one shared bounds check than split the logic across two different techniques.

**No `stopPropagation` needed.** Because the branch is geometric (position-based), a click that lands on a slot/divider/freeform element runs that element's own handler and *also* bubbles to the page-rectangle/viewport handlers — which then see the position is inside the content box and no-op. No new stopPropagation calls are needed anywhere, so this doesn't risk breaking the existing `suppressNextClickRef` drag-suppression pattern already in place for dividers and freeform drags.

**Toggle-off on re-activating an already-selected root**, matching the existing `imageSlot` convention (`if (selectedSlotId === id) clearSelection(); else setSelection(...)`) — kept for consistency rather than inventing a different interaction for this one selection target.

**An armed library-image selection is simply overwritten, not specially handled.** Activating the margin band or outside-page area while `selection.kind === 'image'` just calls `setSelection({ kind: 'node', id: rootNode.id })` like any other non-assignable target would if it had a handler — the root isn't a valid tap-to-assign target (it's not an `imageSlot` or `freeformCanvas`), so no assignment branch is added. This silently cancels the armed image, which is consistent with there being no way to keep an image armed while changing the selection to a node.

## Risks / Trade-offs

- [Two separate `onClick` handlers (page rectangle, viewport) doing similar bounds math] → Small and mechanical; extracting a shared helper is reasonable during implementation if it stays simple, but isn't required by this design.
- [Geometric bounds check must exclude the root's own padded content box exactly, not just "inside the page rectangle"] → The padding values used for the existing dashed-outline `<div>` (`page.rootNode.paddingMm`) are the same source of truth to reuse for the click's bounds check, so the two can't drift apart.
- [In Simple layout mode, re-activating an already-selected root doesn't visibly clear the selection ring, unlike the Nested-mode case] → Pre-existing, unrelated to this change: `uiSlice.ts`'s `clearSelection` currently falls back to reselecting the active page's root whenever `layoutMode === 'simple'` (`computeDefaultSelection`), rather than nulling the selection the way it does in Nested mode. Since the root margin/outside-page toggle-off calls the exact same `clearSelection()` an `imageSlot` toggle-off already calls, it inherits this exact same limitation — confirmed during manual verification to affect a plain `imageSlot` root's own pre-existing toggle-off identically, so it isn't a regression introduced here. `responsive-shell` (still an open, unmerged PR) already fixes `clearSelection` to null uniformly in both modes; once that lands, this toggle-off starts behaving visibly in Simple mode too, with no changes needed on this change's side.
