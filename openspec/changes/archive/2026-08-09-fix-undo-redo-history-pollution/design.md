## Context

`src/store/index.ts` wraps the zustand store creator in `zundo`'s `temporal(...)`:

```ts
temporal(
  (set, get) => { ... },
  { partialize: (state) => ({ document: state.document }) },
)
```

Reading `node_modules/zundo/dist/index.js`'s `temporalHandleSet`:

```js
const currentState = options?.partialize?.(get()) || get();
const deltaState = options?.diff?.(pastState, currentState);
if (!(deltaState === null || options?.equality?.(pastState, currentState))) {
  curriedHandleSet(pastState, undefined, currentState, deltaState);
}
```

With neither `diff` nor `equality` configured, `deltaState` is `undefined` (never `null`) and `options?.equality?.(...)` is `undefined` (falsy), so the `!(...)` is always `true` — every `set()` call anywhere in the store pushes a `pastStates` entry and clears `futureStates`, whether or not `document` (the only partialized field) actually changed. `src/store/uiSlice.ts`'s setters (`setSelectedElementIds`, `setActiveTool`, `setActivePageId`, `setLayoutMode`, `clearSelection`) call the store's `set` with only a `ui` key in their partial update, never touching `document` — so this class of action always triggers a spurious push. Two call sites in `src/store/index.ts` already work around this individually: `reanchorActivePageId` and `setViewMode`, both wrapping their own `set()` in `useEPPStore.temporal.getState().pause()`/`.resume()`.

Every actual document-mutating action in `src/store/documentSlice.ts` (and the two in `src/store/index.ts`: `addPage`, `removePage`) sets `document` to a freshly constructed object (`document: { pages: [...] }` or `document: { ...spread }`) — grepped for any accidental `document: state.document` re-assignment or `...state.document` spread with no actual change, and found none outside `partialize` itself (which just aliases the reference, doesn't create a new one). So whenever a `set()` call doesn't intend to change `document`, `state.document`'s object reference is left completely untouched by zustand's shallow merge — it is not just deep-equal, it is the exact same reference.

## Goals / Non-Goals

**Goals:**
- Make "a UI-only action never creates an undo/redo history entry" true unconditionally and automatically, for every current setter and every setter added in the future, without requiring a manual pause/resume wrap at each call site.
- Keep every existing "an action produces exactly one undo step" guarantee (`addPage`, `removePage`, divider-drag, freeform-transform gestures) working exactly as before.

**Non-Goals:**
- Not introducing a deep/structural equality library (e.g. `fast-deep-equal`) — see Decisions below for why referential equality on `document` is sufficient given this codebase's existing update conventions.
- Not changing `documentSlice.ts`'s or any UI component's behavior — this change is confined to the store's temporal-tracking configuration and its own tests.
- Not auditing or fixing unrelated zundo behavior beyond this specific pollution bug (e.g. history size limits, persistence) — out of scope.

## Decisions

### Configure `equality` as a referential check on the partialized `document`
Add `equality: (pastState, currentState) => pastState.document === currentState.document` to the `temporal(...)` options in `src/store/index.ts`. Because `partialize` already narrows both `pastState` and `currentState` to `{ document }`, and every real document-mutating action always constructs a new `document` object (verified above), a `set()` call that doesn't touch `document` leaves that reference bit-for-bit identical — referential equality is exactly as precise as a deep-equality check here, at zero extra cost and with no new dependency.

*Alternative considered*: a `diff` function returning `null` when `document` is unchanged (zundo's other supported hook, checked first in `temporalHandleSet`). Rejected as strictly worse for this case — `diff`'s contract is "return the delta to store instead of the full state" (for storage-size optimization), which isn't a problem this store has; `equality` is the hook that directly expresses "was anything trackable different," which is exactly the question here.

*Alternative considered*: keep the per-setter `pause()`/`resume()` pattern and simply add it to `setSelectedElementIds`, `setActiveTool`, `setActivePageId`, `setLayoutMode`, and `clearSelection` too. Rejected — it fixes only the five setters known about today, not any UI-only setter added later (the same class of bug this change exists to fix once and for all), and multiplies a manual, easy-to-forget convention across five more call sites instead of one config line.

### Simplify `reanchorActivePageId` and `setViewMode` back to plain `set()` calls
Both become redundant once `equality` is configured: `reanchorActivePageId` only runs when `state.document.pages` no longer contains `activePageId` (an undo/redo side effect) and its own `set({ ui: ... })` call never touches `document`, so `equality` alone already prevents it from pushing a spurious entry — the `pause()`/`resume()` wrap adds no further protection, just an extra pair of calls. Same reasoning for `setViewMode`. Both are simplified to plain `set()` calls (removing the override of `setViewMode` entirely, letting `createUiSlice`'s own version — plain `set()`, the shape every other `ui` setter already uses — stand unmodified) once the regression tests (see tasks.md) confirm `equality` alone covers their exact call patterns, including the post-`undo()`/`redo()` timing `reanchorActivePageId` runs under.

*Alternative considered*: keep both wraps as defense-in-depth even after the root-cause fix lands. Rejected — the whole point of two independent, redundant pollution-prevention mechanisms is that they're expected to always agree; keeping a redundant one around after the general fix is verified is dead code implying uncertainty in the fix itself, not real extra safety, and every other `ui`-only setter is going to rely on `equality` alone anyway.

## Risks / Trade-offs

- [Risk] `equality` short-circuits `temporalHandleSet` for *any* `set()` call where `document`'s reference is unchanged — if some future action legitimately mutates `document` in place (rather than constructing a new object), its change would silently stop being tracked. → Mitigation: this would already break the app today independent of this change, since zustand/React only re-render on reference changes — in-place `document` mutation is already an implicit, load-bearing invariant of the whole store, not a new one this change introduces. The existing "exactly one undo step" tests for `addPage`/`removePage`/divider-drag/freeform-transform are the regression guard that a real document change still gets tracked.
- [Risk] Simplifying `reanchorActivePageId`/`setViewMode` in the same change that introduces `equality` makes it harder to isolate which half caused a problem if something regresses. → Mitigation: land and test the `equality` config first (tasks are ordered this way), confirm the existing pause/resume call sites still behave correctly under it before touching them, then simplify as a distinct, easily-revertible follow-up step within the same change.
