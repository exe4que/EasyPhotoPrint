## Why

Easy Photo Print was built under a hand-rolled "spec anchored" convention (`OPENSPEC.md` + `AGENTS.md` + `SPEC_MAP.md` + `@spec` code tags) instead of the actual OpenSpec CLI, which is now installed and initialized (`openspec/config.yaml`, schema `spec-driven`) but has empty `specs/` and `changes/` directories. The project is already far along — most capabilities described in the old `OPENSPEC.md` are implemented and working. This change captures that existing, already-shipped behavior as native OpenSpec capability specs so that `openspec/specs/` becomes the real source of truth going forward, before any new feature work (project save/load, printing, polish) is proposed as a normal delta change.

## What Changes

- Introduce 6 capability specs under `openspec/specs/`, each describing CURRENT, already-implemented behavior verified against the codebase (not aspirational behavior).
- `project-persistence` is captured only for the parts that already work today (image ingestion into the pool, the in-memory `EPPProject` model, assign/swap/reconcile logic). Saving/opening `.eppproj` files to/from disk is still a stub (`throw new Error('... not implemented yet.')` in `electron/main/ipc/fs.handlers.ts`) and is deliberately **not** claimed as working here — left as a gap for the follow-up change to fill via `ADDED Requirements`.
- `pdf-export` and `printing` are **not** baselined here: neither has any real current behavior (`electron/main/ipc/print.handlers.ts` is a bare stub that always throws; there is no PDF pipeline code at all yet). Baselining a capability with nothing genuinely implemented would misrepresent current truth, so both are left for the follow-up change to introduce as brand-new capabilities.
- No application code changes in this change — this is a documentation/process migration only, superseding the old `OPENSPEC.md`/`SPEC_MAP.md`/`@spec` tag convention (retired in a follow-up cleanup once these specs are archived).

## Capabilities

### New Capabilities
- `layout-engine`: two-pass mm-based layout resolution — nested flex-like distribution (`horizontal`/`vertical`), `grid`, `freeformCanvas` positioning, image fit modes, divider drag-resize, specific-size clamping, feasibility validation, template reconciliation, Simple-mode compatibility gating.
- `template-schema`: `EPPTemplate`/`LayoutNode` JSON schema (grid/horizontal/vertical/imageSlot/freeformCanvas node types, gap/padding/alignment/fixedSizeMm/specificSizeMm), and the schema-version migration mechanism.
- `project-persistence`: the `EPPProject`/`ImageAsset`/`PageConfig` data model, the image-ingestion IPC flow (native open-file dialog + thumbnailing), and the assign/swap/reconcile logic already implemented in the renderer store — explicitly excluding save-to-disk and open-from-disk of `.eppproj` files, which remain unimplemented.
- `units-settings`: metric/imperial unit system toggle, `AppSettings` persistence via IPC, `formatLength`/`parseLength` conversion layer.
- `electron-shell`: process architecture (contextIsolation/sandbox), IPC handler registration pattern, trimmed application menu, `File > New` Main→Renderer flow.
- `undo-redo`: `zundo` temporal store scoped to `document` only, `pauseHistory`/`resumeHistory` wrapping drag gestures into single undo steps.

### Modified Capabilities
(none — `openspec/specs/` is currently empty, so nothing exists yet to modify)

## Impact

- Affected: `openspec/specs/**` (new files only). No source code under `electron/`, `packages/`, `src/`, or `shared/` is touched by this change.
- `pdf-export` and `printing` are intentionally absent from this baseline (see What Changes) — they will be introduced as new capabilities directly in the follow-up change instead of being baselined here with nothing real to describe.
- Downstream: once archived, `AGENTS.md`/`CLAUDE.md` are rewritten to point at `openspec/specs/` + the `openspec` CLI as the source of truth, and `OPENSPEC.md`, `SPEC_MAP.md`, and the 46 `@spec OPENSPEC.md §X` code comments are retired (tracked as separate follow-up work, not part of this change's `tasks.md`).
