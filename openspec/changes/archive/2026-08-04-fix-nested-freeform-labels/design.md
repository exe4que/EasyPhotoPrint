## Context

`resolveLayout`'s `recordFreeformElements` (`packages/layout-engine/src/resolveLayout.ts`) records one `Map` entry per `FreeformElement`, keyed by `element.id` (a `crypto.randomUUID()` generated in `addFreeformElement`, `src/store/documentSlice.ts`) — this is correct and necessary; `FreeformElementView` and hit-testing both need that resolved box.

`PageStage.tsx`'s Nested-mode "container outline" loop (currently ~line 199-220) draws a dashed box + id badge for every entry in `layout.entries()` that passes `id !== page.rootNode.id && !imageSlotMap.has(id) && !freeformCanvasMap.has(id)`. This is a **negative** filter: "show an outline unless we know this id belongs to an imageSlot or a freeformCanvas." `element.id` belongs to neither set — it was never a `LayoutNode` id at all, `imageSlotMap`/`freeformCanvasMap` are built by walking the tree's `children`, and `FreeformElement`s live in a separate `freeformElements` array, not `children`. So every freeform element's id silently qualifies as "an unrecognized container" and gets outlined + labeled with its own GUID, sitting at the exact same box as the image itself (only visibly peeking out at small sizes or when zoomed out, due to sub-pixel rounding between the two independently-styled boxes).

Separately, `freeformCanvas` node ids are explicitly excluded from this same loop (via `!freeformCanvasMap.has(id)`), so — bug aside — there was never any outline/badge for the freeform container itself in the first place, unlike every other container type.

## Goals / Non-Goals

**Goals:**
- Make container identification positive (an explicit allowlist of container node types), not negative — so no future node type/id shape can leak through by omission the way `FreeformElement.id` did.
- Give `freeformCanvas` the same outline+badge treatment as `grid`/`horizontal`/`vertical`, closing the gap the user asked for.

**Non-Goals:**
- Not touching `resolveLayout`/`recordFreeformElements` — the per-element box entries are correct and used elsewhere (rendering position, hit-testing). The bug is entirely in how `PageStage.tsx` classifies `layout` entries for the outline treatment, not in what `layout` contains.
- Not changing the freeformCanvas's existing inner dashed padding-boundary rect (the clip-area guide) — the new outer container outline is additive, at the freeformCanvas's full box, same as any other container; the existing inner rect keeps marking the padded/printable area as it does today.

## Decisions

**Positive allowlist via a new `collectContainerNodes` helper**, mirroring the existing `collectImageSlotNodes`/`collectFreeformCanvasNodes`/`collectFlexContainerNodes` pattern already in `PageStage.tsx`: walks `page.rootNode.children` recursively, collecting only `grid`/`horizontal`/`vertical`/`freeformCanvas` type nodes. The outline loop's filter becomes `containerNodeIds.has(id) && id !== page.rootNode.id` instead of the current double-negative. Because this walks `children` (the actual tree), a `FreeformElement`'s id — which lives in `freeformElements`, a sibling array `collectContainerNodes` never touches — cannot structurally end up in the resulting set, regardless of what it looks like.
- *Alternative considered*: keep the negative filter but add a third exclusion, e.g. collect all `freeformElements[].id` values across the tree and exclude those too. Rejected — this treats the symptom (one specific id source) rather than the actual defect (using exclusion instead of inclusion for a fundamentally closed set of container types); the next new id-bearing concept added to the layout result would reintroduce the same class of bug.

**`freeformCanvas` joins the same existing outline loop, not a new dedicated one.** Since the fix already builds a general container-id set, including `freeformCanvas` in it is a one-line addition, and it reuses the exact same dashed-outline + id-badge rendering every other container gets — no new visual language to introduce.

## Risks / Trade-offs

- [Risk] Selecting a freeform element for the resize/rotate handles behaves the same before and after this fix — the outline loop is `pointer-events-none` (purely visual), so removing the stray per-element outlines cannot affect click/drag hit-testing. Confirmed by reading the existing `className="pointer-events-none absolute border border-dashed ..."` on that loop's container div.
- [Risk] Adding `freeformCanvas` to the outline loop draws a dashed box at its full bounds even when it already has its own inner padding-boundary rect a few pixels inset — mitigated by using the same subdued outline styling every other container already uses (`border-slate-500/70`), so the two nested dashed rects (outer = full box + id, inner = padding boundary) read as a coherent pair rather than visual clutter.
