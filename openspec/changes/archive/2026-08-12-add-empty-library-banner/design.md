## Context

`DesktopShell.tsx` renders `PageStage` and `ImageLibraryPanel` stacked in the same middle grid column (`DesktopShell.tsx:104-109`); the Image Library panel is always visible there, nothing needs to be opened to reach it. `MobileShell.tsx` is canvas-first — `PageStage` fills the remaining height on its own (`MobileShell.tsx:157-159`), and the Image Library only exists inside the `photos` bottom sheet, toggled via local `openTab` state (`MobileShell.tsx:45,109-116,176-183`). See `proposal.md` - Why for the motivation.

Tailwind is already used with no custom theme extension before this change (`tailwind.config.cjs` had an empty `extend`); `animate-spin` (a built-in Tailwind utility) is already used elsewhere (`ProcessingOverlay.tsx`). The requested highlight is a color flash (an amber glow that ramps up and back to nothing) with a bouncy feel, not the element itself moving — CSS has no built-in "bounce" timing-function (unlike `ease`/`ease-in-out`), so this needs a small custom keyframe animation in `tailwind.config.cjs`'s `theme.extend`, not a reuse of Tailwind's built-in `animate-bounce` (which translates the element via `transform`, the wrong effect here).

## Goals / Non-Goals

**Goals:**
- One presentational banner component shared by both shells, with per-shell click behavior injected rather than duplicated.
- The desktop highlight is a color flash (glow ramps to amber and back to nothing), not a positional bounce of the panel itself.

**Non-Goals:**
- Persisting a "banner dismissed" flag anywhere (settings, localStorage) — the banner has no dismiss control per the proposal, so there's nothing to persist.
- Changing `ImageLibraryPanel` itself — the highlight is applied to a wrapper `DesktopShell` renders around it, not to the component.
- A full application-width banner spanning the sidebars — "above the page" is read literally as above the canvas specifically, so the banner is scoped to the same column/width `PageStage` occupies on each shell, not the full viewport.

## Decisions

- **New shared component `EmptyLibraryBanner`** (`src/components/shell/EmptyLibraryBanner.tsx`, alongside `DocumentSummary`/`BottomSheet`/`BottomTabBar` — this codebase's existing home for shell-support components). Reads `imagePool` from the store itself (`useEPPStore((state) => state.imagePool.length === 0)`) and renders `null` when the pool isn't empty, so both shells get the same reactive visibility for free instead of each computing and passing a boolean down. Takes one prop: `onActivate: () => void`.
- **Desktop highlight**: `DesktopShell` wraps `<ImageLibraryPanel />` in a `ref`'d `<div>` (the same pattern `MobileShell.tsx`'s `photosPanelRef` already uses for the Photos sheet's drop-bounds check). `onActivate` calls `ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` and sets a local `isHighlighted` boolean to `true` for ~1.2s via `setTimeout`, applying a new `animate-flash-amber` utility class while `true`. That utility plays a single-iteration custom keyframe (`flash-amber`, `tailwind.config.cjs`) that ramps an amber `box-shadow` glow up and back to nothing, with its intermediate keyframe stops (overshoot, undershoot, small rebound) shaped to read as a bounce, rather than moving the element's position. `scrollIntoView` is a no-op when the panel is already fully in view, which it always is today (both stack in one visible column), but keeps the behavior correct if that layout ever changes.
- **Mobile activation**: `MobileShell` passes `onActivate={() => setOpenTab('photos')}` — identical to what tapping the Photos tab already does (`handleSelectTab('photos')` collapses to the same `setOpenTab` call when nothing is selected, which is always true here since the banner only shows on an empty library, and an empty library can't have a selected image).
- **Banner styling**: amber/yellow warning treatment (`bg-amber-500/10 border-amber-500/40 text-amber-200`, matching this codebase's existing rose-toned error-banner convention elsewhere, e.g. `PreviewScreen.tsx`'s error text, `ImageLibraryPanel.tsx`'s error box) — a `role="button"`/`tabIndex={0}` div (matching `ImageCard`'s existing clickable-div pattern in `ImageLibraryPanel.tsx`) with `onClick` and an `onKeyDown` Enter/Space handler calling `onActivate`, rather than a `<button>`, so it can read as a banner (block-level, full width of its column) rather than a button-shaped control.

## Risks / Trade-offs

- [A single CSS `animation-timing-function` can't reproduce a genuine multi-oscillation bounce on its own] → Addressed by shaping the bounce directly into the keyframe's percentage stops (peak, undershoot, small rebound) instead of relying on timing-function alone — the same technique general-purpose "bounce" animation libraries use, just applied to a `box-shadow` glow instead of position.
