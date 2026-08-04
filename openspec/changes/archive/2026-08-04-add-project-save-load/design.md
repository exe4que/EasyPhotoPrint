## Context

See `proposal.md` for motivation. Relevant current state:

- `electron/main/ipc/fs.handlers.ts` already registers `fs:open-project`/`fs:save-project` as stubs that throw. `dialog:open-images` (real, working) shows the pattern to follow: a renderer-invoked IPC call that internally shows a native dialog and returns data — Main never pushes unsolicited data to the renderer for this kind of flow.
- `src/store/documentSlice.ts`'s `DocumentState` is just `{ pages: EPPProjectPage[] }` — no project `id`/`name`/file-path is tracked anywhere today. `imagePool` lives in a separate slice. Neither is wrapped with an `EPPProject` envelope at runtime; that envelope only gets synthesized ad hoc when exporting a single page as a template.
- `packages/migrations/src/index.ts` already exports a working `migrateProject(raw)` validator (schemaVersion/id/name/pages/imagePool as arrays of objects) — no changes needed there.
- `File > New` already establishes the only precedent for a menu item that needs renderer confirmation before discarding state: Main sends a payload-free `menu:new-project` event; the renderer (which owns the confirm dialog component and the store) does everything else.
- `zundo` wraps only the `document` slice (per the `undo-redo` capability). Any new "what file is this" state must live outside that wrapping, the same way `settings` already does, or undoing could theoretically rewind which file `Save` targets.

## Goals / Non-Goals

**Goals:**
- Real disk save/open behind the already-scaffolded IPC channels, matching desktop conventions (Save silent-after-first-time, Save As always prompts, Open confirms first).
- Keep the saved file minimal: no image bytes, no thumbnails, no per-project asset copies (already true today, this change must not regress it).
- Loading a project must be resilient to a moved/renamed/deleted source image — one bad path degrades gracefully instead of failing the whole load, and the user gets a way to fix it (both immediately and later).

**Non-Goals:**
- No dirty-state tracking. `Save` always writes; there is no "unsaved changes" indicator anywhere, and no confirmation gate before `New`/`Open` beyond the confirmation dialog `New` already has (`Open` reuses the identical pattern).
- No multi-page authoring UI work. The schema already supports multiple pages and this change must not break that, but there is still no way to add a second page from the UI — out of scope here.
- No recent-files list, no auto-save, no crash recovery. Purely the two menu-driven flows the user asked for.

## Decisions

**New state: `project: { filePath: string | null }`, outside `zundo`.** Sibling to `settings`, not part of `document`. `Save` with `filePath == null` behaves exactly like `Save As` (open the dialog); once set, `Save` writes silently. `Save As` always opens the dialog and overwrites `filePath` with whatever the user chose, on success. `Open` seeds `filePath` with the opened file's path so the very next `Save` writes silently to it. `New` resets `filePath` to `null`, same moment it resets `document`/`ui`/`imagePool` and clears undo history.
- *Alternative considered*: derive "should Save prompt" from whether the in-memory document differs from what's on disk (real dirty-tracking). Rejected per explicit instruction — the user wants Save to just always write, no tracking, no indicator.

**Open follows the same shape as New (confirm-then-invoke), not "picker-first".** Main sends a payload-free `menu:open-project` event; the renderer shows the confirm-discard dialog; only on confirmation does it call `window.eppAPI.fs.openProject()`, which is where Main actually shows the native picker and does the read/validate/regenerate-thumbnails work, returning the project (or throwing if canceled/invalid).
- *Alternative considered*: Main shows the native picker immediately on menu click, and only sends an event to the renderer (with the already-loaded project data) once a file is actually chosen — this avoids ever showing "discard changes?" if the user was just going to cancel the picker. Rejected — explicitly, in favor of reusing the exact IPC direction and component pattern `New` already established (renderer-invoked `fs.openProject()`, matching the existing stub signature) rather than inverting who initiates the data fetch.

**Missing-image detection happens inside the existing open flow, not as a separate pass.** While Main is regenerating each `ImageAsset`'s thumbnail from `originalPath` (reusing the exact resize logic `fs.handlers.ts` already has for `dialog:open-images`), a decode failure for one entry does not throw for the whole `openProject` call — that entry gets `missing: true` plus a placeholder thumbnail, and `widthPx`/`heightPx` are read from the file being opened (they were already persisted, no disk read of the actual image needed to know them).

**Relink dialog reuses the existing `ConfirmDialog` component via its `children` slot**, listing every `missing` asset as a row with its own "Locate..." button (each independently triggers a single-file native picker + re-ingestion), with a single "Done" button closing the dialog without forcing every row to be resolved.
- *Alternative considered*: a sequential native file-picker per missing image, chained automatically right after load. Rejected — with several missing images this stacks native dialogs one after another, which is worse UX than one list the user can act on at their own pace (and matches what was explicitly asked for).

**"Locate..." is a capability of the asset, not a one-time modal action.** The same relink logic (pick a file → re-derive path/dimensions/thumbnail → clear `missing`) is exposed both from a row in the load-time dialog and as a persistent affordance on that asset's `ImageLibraryPanel` card for as long as it stays `missing` — there is exactly one relink code path, just two UI entry points into it.

**`ImageAsset` gains one optional field: `missing?: boolean`.** Everywhere else in the type stays as-is; `widthPx`/`heightPx`/`fileName` etc. remain required and meaningful even when `missing` is true (they came from the save file, not from re-reading the image). This keeps the "ImageAsset Data Shape" requirement in `project-persistence` unchanged — `missing` is not present at ingestion time, only ever set during a project open.

**Gap found during implementation — where does `EPPProject.name` (a required field) come from?** Neither the proposal nor this design originally addressed it, and there is no project-name input anywhere in the UI (unlike templates, which get a name via `SaveTemplateDialog`). Resolved pragmatically rather than pausing to ask: `project.name` is derived from the chosen filename (basename minus `.eppproj`) whenever a save dialog actually runs (first `Save` or any `Save As`), and left untouched on a silent subsequent `Save`. `project.id` is generated once per in-memory project (at app start, or adopted from an opened file's own `id`) and stays stable across saves — nothing in the app keys off it today, but keeping it stable avoids a project's identity churning on every save for no reason. Tracked as `project: { id, name, filePath }` in the new store slice (only `filePath` was in the original design). This is an implementation default, not a new user-facing requirement — no spec delta needed, since `name`/`id` were already required fields of the pre-existing `EPPProject` shape and no requirement promises anything observable about how they're derived.

**Saved-file shape is exactly `EPPProject` minus `thumbnailDataUrl` per `ImageAsset`, and `missing` is never persisted.** The renderer strips `thumbnailDataUrl` before invoking `saveProject`; Main also strips `thumbnailDataUrl`/`missing` defensively (`prepareProjectForSave` in `fs.helpers.ts`) rather than trusting the renderer's payload is already clean — cheap, and guards against a future renderer change forgetting to strip. `missing` is a load-time-derived fact, not saved state — if a user relinks an image mid-session, the next save simply reflects its corrected `originalPath` like nothing was ever wrong.

## Risks / Trade-offs

- [Risk] A user could trigger `Save As`, cancel the native dialog, and the app should not treat that as "now unsaved" or change `filePath` → Mitigation: `filePath` is only overwritten on a *successful* save; a canceled dialog is a no-op, matching how `dialog:open-images` already treats cancellation (returns nothing, no state change).
- [Risk] Regenerating N thumbnails synchronously on every `Open` could be slow for a project with many images → Mitigation: this reuses the exact same per-image resize work `dialog:open-images` already does for freshly ingested images today, so it is not a new performance category — just done for possibly more images at once. No pagination/streaming attempted in this change; revisit only if it proves slow in practice.
- [Risk] Without dirty-tracking, a user can lose in-memory work by clicking `New` or confirming `Open` without realizing they never saved → Mitigation: this is an explicit, accepted trade-off for keeping the feature simple (see Non-Goals) — the existing `New` confirmation dialog's copy should make clear that current work is discarded, and `Open`'s reused dialog should say the same.
