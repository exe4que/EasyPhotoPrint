## 1. Contract and registry

- [x] 1.1 Create `src/lib/platform/contract.ts` carrying over `EppAPI` and `AppSettings` from `src/lib/ipc-client.ts` unchanged in shape, plus a module-level adapter registry.
- [x] 1.2 Add `registerPlatformAdapter(adapter: EppAPI): void`, which replaces any previously registered adapter.
- [x] 1.3 Change `getEppApi()` to read from the registry instead of `window.eppAPI`, throwing an explicit "no platform adapter has been registered" error when empty — never a generic undefined-property failure.
- [x] 1.4 Move the `declare global { interface Window { eppAPI } }` augmentation out of the contract module; it is Electron-specific knowledge and belongs with the Electron adapter.
- [x] 1.5 Delete `src/lib/ipc-client.ts` and repoint its 8 importers (`App.tsx`, `store/index.ts`, `store/settingsSlice.ts`, `store/imagePoolSlice.ts`, `hooks/useTemplateLibrary.ts`, `hooks/usePrintResolutionSrc.ts`, `components/templates/TemplateGallery.tsx`, `components/templates/SaveTemplateDialog.tsx`) at the new module. Import paths change; no `getEppApi()` call expression does.

## 2. Electron adapter

- [x] 2.1 Create `src/lib/platform/electronAdapter.ts` exporting `createElectronAdapter(): EppAPI`, holding the `Window` augmentation from 1.4.
- [x] 2.2 Validate `window.eppAPI` is present at construction time and return it directly — a pass-through, not a per-method forwarding wrapper (design.md, decision 2).
- [x] 2.3 When `window.eppAPI` is absent, throw an error identifying the missing Electron preload surface, rather than registering an adapter whose members fail later on first use.
- [x] 2.4 Register the adapter from `src/main.tsx` before `createRoot(...).render(...)`, so no shared code can observe an unregistered state.

## 3. Tests

- [x] 3.1 Replace `installMockEppApi` in `src/store/index.test.ts` with `registerPlatformAdapter(...)`, dropping both the `globalThis.window` assignment and the matching `delete (globalThis as ...).window` cleanups in the `afterEach` blocks.
- [x] 3.2 Add contract tests: a registered adapter is what `getEppApi()` returns; registering again replaces the previous one; calling `getEppApi()` with nothing registered throws an error naming the missing registration.
- [x] 3.3 Add a test that `createElectronAdapter()` throws a clear error when `window.eppAPI` is absent.

## 4. Verification

- [x] 4.1 Run the full test suite and typecheck.
- [x] 4.2 Confirmed the seam holds: `window.eppAPI` is referenced only in `src/lib/platform/electronAdapter.ts` (and its test); all 20 `getEppApi()` call sites remain inside effects, handlers, or async actions, none at module scope.
- [x] 4.3 Verified end-to-end in the real Electron app (Playwright `_electron` driver under xvfb, native dialogs stubbed, menu commands triggered via real `Menu.click()` in the main process): unit toggle switches and reflects immediately; Load Images (`dialog.openImages`) adds the image to the library; `Edit > Save Template As...` (`menu:save-template-as` -> `templates.save`) creates and lists a real template; `Edit > Undo`/`Redo` (`menu:undo`/`menu:redo`) correctly revert and reapply an orientation change; `File > Save` (`menu:save-project` -> `fs.saveProject`) writes a real project file; `File > New` (`menu:new-project`) opens the renderer confirmation dialog rather than resetting instantly, and confirming resets to a single page; Export PDF (`pdf.export`) writes a valid multi-byte PDF. Every one of these round-trips through `getEppApi()` -> the registered Electron adapter -> `window.eppAPI` -> the unchanged IPC channels.
- [x] 4.4 Ran `openspec validate --strict --changes extract-platform-adapter` — passes.
