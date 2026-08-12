## Context

This is the app's first cross-component "blocking" UI state — today, busy feedback (`ImageLibraryPanel`'s missing state, `PreviewScreen`'s `exportState`/`printState`) is local `useState` per component, and nothing prevents interacting with the rest of the app while an async operation runs. See `proposal.md` - Why. None of the three underlying operations (image decode/merge via `openImagesFromDialog`, `exportPdf()`, `printDocument()`) currently report incremental progress over IPC — they resolve or reject a single Promise.

## Goals / Non-Goals

**Goals:**
- One shared overlay primitive and one shared piece of global state driving it, instead of three separate ad hoc implementations.
- Full interaction block (pointer + keyboard) while the overlay is visible, including preview-screen navigation and the export/print controls themselves.
- No changes to IPC contracts or the underlying async operations' behavior.

**Non-Goals:**
- Determinate, incremental progress reporting (e.g., "3 of 7 images decoded", PDF page-by-page progress). None of the three operations currently emit progress events, and adding that instrumentation is backend work the proposal explicitly excludes.
- A general-purpose toast/notification system. Existing inline error text (`ImageLibraryPanel`'s `errorMessage`, `PreviewScreen`'s error states) is left as-is; the overlay only owns the "in flight" state, not error presentation.

## Decisions

- **Indeterminate spinner, not a determinate bar, for all three operations.** The spec (`processing-overlay`) allows a progress bar OR a spinner when determinate progress isn't available. Since none of the three operations reports partial progress today and instrumenting them is out of scope (see Non-Goals), a determinate bar would either be fake (not tied to real progress) or require new IPC plumbing. Alternative considered: add a coarse "N of M images" counter for the library-ingest case only, since that one is a batch — rejected for this change to keep the three operations consistent and the change small; can be revisited later without a spec change (the requirement already permits either UI).
- **Global state lives in `uiSlice.ts`, not a new store slice.** `uiSlice.ts` is already the existing home for cross-cutting UI state (per the codebase's own convention). Shape: a single `processingOverlay: { visible: boolean }` flag (no per-operation label needed — the requirement doesn't call for one, and adding one would be speculative). Alternative considered: local overlay state re-derived independently in each of the two call sites — rejected because it can't block interaction *outside* the component that owns the async call (e.g. blocking preview-screen navigation from inside the Image Library flow would be impossible without shared state).
- **One `ProcessingOverlay` component, mounted once near the app root**, reading the shared `visible` flag, rather than rendering it inside `ImageLibraryPanel` and `PreviewScreen` separately. This guarantees it always renders above everything (single stacking context) and blocks the whole viewport regardless of which screen triggered it.
- **Blocking mechanism**: a full-viewport fixed-position element with a high z-index whose backdrop captures all pointer events (so clicks on anything behind it no-op), combined with checking the shared `visible` flag at the top of any global keyboard-shortcut handler (e.g. preview's Escape-to-exit) so it short-circuits while the overlay is up, rather than relying on `pointer-events` alone to stop keyboard input.
- **Overlay lifecycle is `try/finally` around each of the three call sites** (`handleOpenImages`, `handleExportPdf`, `handlePrint`), setting `visible: true` before the async call and `visible: false` in `finally`, so it clears on success, error, and dialog cancellation alike per the "Overlay Always Resolves" requirement.

## Risks / Trade-offs

- [Indeterminate spinner gives no real progress signal for a slow multi-page PDF export] → Acceptable for this iteration per the user's own spinner fallback; revisit only if real usage shows it's a problem, since adding fake progress would be worse than an honest spinner.
- [Blocking overlay could flicker on near-instant operations, e.g. adding one small already-cached image] → No artificial minimum-display delay is added; a brief flash is preferable to adding timing logic for a case that isn't reported as a problem.
- [A future operation forgets to wrap its async call in try/finally and leaves the overlay stuck] → Keep the wiring to exactly the three call sites named in the proposal; no generic "wrap any async action" helper is introduced, since that would be speculative for operations that don't exist yet.
