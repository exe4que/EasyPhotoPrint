## Why

Easy Photo Print is meant to run as one application on both desktop (Electron) and Android, from one renderer codebase, with as little platform-specific code as possible. Today the renderer is structurally locked to Electron in exactly one place: `getEppApi()` returns `window.eppAPI` or throws, so every native capability — file dialogs, project read/write, PDF export, printing, settings, templates, image decoding, menu events — is reachable only when an Electron preload happens to have run.

The rest of the renderer is already platform-neutral: it has zero imports from `electron` or `node:`, and all 27 call sites across 8 files invoke `getEppApi()` at the moment of use rather than capturing it at module load. That means the implementation behind that one function can be swapped with no call-site churn at all — but only once there is a contract and a way to select an implementation.

Doing this first, before any mobile code exists, keeps the platform-specific surface small and explicit by construction instead of letting `if (isAndroid)` checks accumulate through the app later. It is also verifiable entirely on desktop.

## What Changes

- `EppAPI` is promoted from an incidental type in `src/lib/ipc-client.ts` to the app's formal **platform contract**: the complete, single surface through which shared renderer code reaches anything the host provides.
- `getEppApi()` stops reading `window.eppAPI` directly. It returns whichever adapter was registered at startup, and fails with an explicit "no platform adapter registered" error when none was.
- A registration entry point is added (`registerPlatformAdapter`). The platform's own entry file registers its adapter before React renders; shared code never selects a platform itself.
- An Electron adapter is added and registered from `src/main.tsx`. It is a thin pass-through over the existing `window.eppAPI`, so desktop behavior — including every IPC channel and menu round-trip — is byte-for-byte unchanged.
- The contract is defined as **total**: every adapter implements every member. A platform that lacks a capability absorbs that inside its own adapter (for example, a host with no native menu bar implements the `menu.*` subscriptions as no-ops that return a working unsubscribe function) rather than shared code branching on platform.
- Location identifiers returned by the contract (today, project file paths) are defined as **opaque handles**. Shared code may show them to the user, but must not join, resolve, or hand them to a filesystem API — so a future host that returns a URI instead of a path needs no changes above the adapter.

Explicitly out of scope: no Capacitor dependency, no mobile adapter, no UI changes, no changes to the project file format, and no changes to any IPC channel or Main-process code.

## Capabilities

### New Capabilities

- `platform-adapter`: the single contract through which the renderer reaches native capabilities, how a concrete implementation is selected at startup, and the rules (totality, opaque identifiers) that keep one renderer codebase running unmodified on every supported host.

### Modified Capabilities

- `electron-shell`: the "Explicit contextBridge API surface" requirement currently states that the renderer accesses native functionality *exclusively* through `window.eppAPI`. That indirection gains a layer — renderer code now reaches it through the registered platform adapter, and the Electron adapter is what binds to `window.eppAPI`. The contextBridge and named-IPC-channel guarantees themselves are unchanged.

## Impact

- `src/lib/ipc-client.ts`: `getEppApi()` changes from a `window.eppAPI` accessor to a registry read; `EppAPI` gains its role as the platform contract. `AppSettings` and the `Window` augmentation stay where they are.
- New: a platform module holding the registry (`registerPlatformAdapter`, `getEppApi`) and the Electron adapter.
- `src/main.tsx`: registers the Electron adapter before `createRoot(...).render(...)`.
- The 27 `getEppApi()` call sites in `App.tsx`, `store/index.ts`, `store/settingsSlice.ts`, `store/imagePoolSlice.ts`, `hooks/useTemplateLibrary.ts`, `hooks/usePrintResolutionSrc.ts`, `components/templates/TemplateGallery.tsx`, and `components/templates/SaveTemplateDialog.tsx` are expected to need **no changes** — confirming that is part of the work.
- No changes to `electron/main/**`, `electron/preload/**`, `packages/**`, or any IPC channel name or payload.
- Testability improves as a side effect: store and hook tests can register a fake adapter instead of stubbing `window.eppAPI`.
