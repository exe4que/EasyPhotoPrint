## Context

`DesktopShell.tsx` renders `PageStage` and `ImageLibraryPanel` stacked in the same middle grid column (`DesktopShell.tsx:104-109`); the Image Library panel is always visible there, nothing needs to be opened to reach it. `MobileShell.tsx` is canvas-first — `PageStage` fills the remaining height on its own (`MobileShell.tsx:157-159`), and the Image Library only exists inside the `photos` bottom sheet, toggled via local `openTab` state (`MobileShell.tsx:45,109-116,176-183`). See `proposal.md` - Why for the motivation.

Tailwind is already used with no custom theme extension (`tailwind.config.js` has an empty `extend`); `animate-spin` (a built-in Tailwind utility) is already used elsewhere (`ProcessingOverlay.tsx`). Tailwind ships `animate-bounce` out of the box too, so the requested "bounce effect" needs no new dependency or custom keyframes.

## Goals / Non-Goals

**Goals:**
- One presentational banner component shared by both shells, with per-shell click behavior injected rather than duplicated.
- Reuse Tailwind's built-in `animate-bounce` for the highlight effect instead of adding a new animation.

**Non-Goals:**
- Persisting a "banner dismissed" flag anywhere (settings, localStorage) — the banner has no dismiss control per the proposal, so there's nothing to persist.
- Changing `ImageLibraryPanel` itself — the highlight is applied to a wrapper `DesktopShell` renders around it, not to the component.
- A full application-width banner spanning the sidebars — "above the page" is read literally as above the canvas specifically, so the banner is scoped to the same column/width `PageStage` occupies on each shell, not the full viewport.

## Decisions

- **New shared component `EmptyLibraryBanner`** (`src/components/shell/EmptyLibraryBanner.tsx`, alongside `DocumentSummary`/`BottomSheet`/`BottomTabBar` — this codebase's existing home for shell-support components). Reads `imagePool` from the store itself (`useEPPStore((state) => state.imagePool.length === 0)`) and renders `null` when the pool isn't empty, so both shells get the same reactive visibility for free instead of each computing and passing a boolean down. Takes one prop: `onActivate: () => void`.
- **Desktop highlight**: `DesktopShell` wraps `<ImageLibraryPanel />` in a `ref`'d `<div>` (the same pattern `MobileShell.tsx`'s `photosPanelRef` already uses for the Photos sheet's drop-bounds check). `onActivate` calls `ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` and sets a local `isHighlighted` boolean to `true` for ~1.2s (two `animate-bounce` cycles at Tailwind's default 1s/iteration) via `setTimeout`, applying `animate-bounce` plus a temporary `ring-2 ring-amber-400` while `true`. `scrollIntoView` is a no-op when the panel is already fully in view, which it always is today (both stack in one visible column), but keeps the behavior correct if that layout ever changes.
- **Mobile activation**: `MobileShell` passes `onActivate={() => setOpenTab('photos')}` — identical to what tapping the Photos tab already does (`handleSelectTab('photos')` collapses to the same `setOpenTab` call when nothing is selected, which is always true here since the banner only shows on an empty library, and an empty library can't have a selected image).
- **Banner styling**: amber/yellow warning treatment (`bg-amber-500/10 border-amber-500/40 text-amber-200`, matching this codebase's existing rose-toned error-banner convention elsewhere, e.g. `PreviewScreen.tsx`'s error text, `ImageLibraryPanel.tsx`'s error box) — a `role="button"`/`tabIndex={0}` div (matching `ImageCard`'s existing clickable-div pattern in `ImageLibraryPanel.tsx`) with `onClick` and an `onKeyDown` Enter/Space handler calling `onActivate`, rather than a `<button>`, so it can read as a banner (block-level, full width of its column) rather than a button-shaped control.

## Risks / Trade-offs

- [`animate-bounce` moves the whole Image Library panel via `transform`, which could look like a layout jump to a user unfamiliar with the effect] → Accepted per the user's explicit request for a "bounce effect"; `transform` doesn't reflow surrounding content, so it's visual only, not a real layout shift.
