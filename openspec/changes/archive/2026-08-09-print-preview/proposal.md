## Why

Before a user can export a PDF or print, they need a way to check what will actually land on paper — today the only view of a page is the editor canvas, which is permanently covered in slot borders, id badges, dimension overlays, and drag targets. This change adds a full-screen, gizmo-free preview of the active page, reachable from a "Preview" button in the app header, laying the groundwork (and the entry point) for the still-unimplemented Export PDF and Print actions.

## What Changes

- Add a "Preview" button to the app header (`src/App.tsx`), to the right, next to the unit toggle.
- Add `ui.viewMode: 'editor' | 'preview'` to the store's UI slice, defaulting to `'editor'` and excluded from undo/redo tracking like the rest of `ui` state.
- Add a full-screen preview screen that replaces the entire editor layout while active, showing only the active page rendered exactly as it will print: no slot borders, id badges, hover states, drag-and-drop, resize dividers, padding outline, or side panels — and no manual zoom control, fit-to-screen only.
- Unassigned image slots render as nothing (blank page background) in preview, instead of the editor's "Drag an image here" placeholder.
- Add chrome-free page navigation inside preview (previous/next + "Page X of Y"), reusing the existing `activePageId` navigation — no Add/Remove Page controls.
- Add two buttons to the top of the preview screen, "Export PDF" and "Print" — visually present but with no click behavior yet (the underlying `pdf:export` / `print:document` IPC handlers remain unimplemented stubs; wiring them up is future work).
- Add an explicit exit control plus Escape-to-exit, returning `viewMode` to `'editor'`. While in preview, Escape exits preview instead of clearing canvas selection.
- Extract the non-interactive "position/scale/rotate one image into its resolved box" rendering logic that is currently inlined inside `PageStage.tsx` and `FreeformElementView`, into shared presentation-only pieces that both the editor canvas and the new preview screen use — so the two views can never drift apart on how an image is actually rendered.

## Capabilities

### New Capabilities
- `print-preview`: the full-screen, gizmo-free preview mode — the header entry point, the `viewMode` state, the faithful single-page rendering (including empty slots and freeform elements), chrome-free page navigation, the exit interactions, and the presence (not behavior) of the Export PDF / Print buttons.

### Modified Capabilities
(none — existing capabilities' documented requirements are unchanged; `page-navigation`'s active-page state is reused as-is, not altered)

## Impact

- `src/App.tsx`: header gets the Preview button; root render branches on `ui.viewMode` to show either the existing editor layout or the new preview screen.
- `src/store/uiSlice.ts`: new `viewMode` field and setter.
- `src/components/canvas/PageStage.tsx`, `src/components/canvas/FreeformElement.tsx`: refactored to source their image-rendering math from a shared, extracted piece rather than duplicating it.
- New component(s) for the preview screen and its chrome-free page switcher (exact file layout decided in design.md).
- No changes to `electron/main/ipc/pdf.handlers.ts` or `print.handlers.ts` — both remain unimplemented stubs; the new buttons do not call them yet.
