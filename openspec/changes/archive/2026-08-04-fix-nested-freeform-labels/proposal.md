## Why

In Nested mode, every image placed inside a `freeformCanvas` shows a stray GUID-looking badge behind it (visible when the element is shrunk toward its minimum size or the page is zoomed out). This is a real bug, not a preference: `PageStage.tsx`'s "nested container outline" loop (dashed border + id badge, meant only for `grid`/`horizontal`/`vertical` container nodes) filters `layout.entries()` by excluding known `imageSlot` and `freeformCanvas` ids — but `resolveLayout`'s `recordFreeformElements` records each `FreeformElement`'s own box under `element.id` (a `crypto.randomUUID()`, unrelated to any `LayoutNode` id), which isn't in either exclusion set. Every freeform element's id slips through the filter and gets treated as if it were an untagged nested container.

Separately, the `freeformCanvas` container itself currently gets **no** outline or label at all in Nested mode (it's explicitly excluded from that same loop), unlike every other container type — so there's no way to see at a glance which region of the canvas is the freeform container while editing its structure.

## What Changes

- Stop the per-freeform-element badge leak: the nested container outline loop must positively identify actual `grid`/`horizontal`/`vertical` container nodes instead of excluding by negation, so `FreeformElement` ids (which were never a `LayoutNode` id to begin with) can no longer slip through.
- Add exactly one outline + id badge for the `freeformCanvas` node itself in Nested mode, matching the existing dashed-outline treatment every other container type already gets — replacing the "nothing at all" status quo.

## Capabilities

### New Capabilities
- `canvas-container-outlines`: how Nested mode visually distinguishes container nodes (`grid`/`horizontal`/`vertical`/`freeformCanvas`) in the page preview via a dashed outline and an id badge, and what is explicitly excluded from that treatment (image slots, individual freeform elements).

### Modified Capabilities
(none)

## Impact

- Affected code: `src/components/canvas/PageStage.tsx` (the nested-mode container outline loop, and the freeformCanvas rendering block).
- No change to `packages/layout-engine` — `resolveLayout`/`recordFreeformElements` are correct as-is (every rendered element legitimately needs its own resolved box; the bug is purely in how the renderer classifies those boxes for the outline treatment, not in the boxes themselves).
- Purely visual; no schema, IPC, or store changes.
