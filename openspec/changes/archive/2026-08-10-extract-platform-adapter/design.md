## Context

The renderer already has exactly one door to the host: `getEppApi()` in `src/lib/ipc-client.ts`, which today returns `window.eppAPI` or throws. Two properties of the current code make replacing what is behind that door cheap:

- Shared renderer code has **zero** imports from `electron` or `node:` — the only Electron dependency is that one global read.
- All 27 call sites across 8 files call `getEppApi()` **at the moment of use** (inside effects, event handlers, or async store actions), never destructuring it at module scope. So swapping the implementation requires no change to a single call expression.

See proposal.md — Why for motivation. This design covers how the adapter is chosen and where the seam lives.

## Goals / Non-Goals

**Goals:**
- One renderer codebase that runs on any host that can satisfy the contract, with no platform branching above the adapter.
- Desktop behavior byte-for-byte unchanged, including every IPC channel and menu round-trip.
- The whole change verifiable on desktop, with no mobile toolchain involved.

**Non-Goals:**
- No Capacitor dependency and no mobile adapter — this change only proves the seam holds with one implementation behind it.
- No change to `electron/main/**`, `electron/preload/**`, or any IPC channel name or payload.
- Not redesigning the contract's shape. The eight existing namespaces are kept as-is; whether, say, `menu` should eventually become a more neutral "host commands" concept is a later question.

## Decisions

### 1. Explicit registration at the entry point, not runtime sniffing

The adapter is installed by the platform's own entry file (`registerPlatformAdapter(createElectronAdapter())` in `src/main.tsx`) before React renders. The alternatives were feature detection (`window.eppAPI != null ? … : …`) and build-time substitution via Vite `define`.

Registration wins because it keeps every platform's wiring in that platform's own entry point, where it is obvious and greppable, instead of in a shared module that grows a branch per host. It also means each platform bundle only imports its own adapter, so the Electron adapter never ships inside a mobile build and vice versa. And it makes tests first-class: a test registers a fake adapter instead of fabricating a `window` global.

Feature detection was rejected specifically because it puts platform knowledge back into shared code — the exact thing this change exists to prevent.

### 2. The Electron adapter is a pass-through, not a wrapper

`createElectronAdapter()` validates that `window.eppAPI` is present and returns that object directly as the contract. It does not build a new object that forwards each method.

This keeps the desktop path free of any added indirection, guarantees behavior is unchanged rather than merely intended to be, and keeps the `electron-shell` scenarios that name `window.eppAPI.menu.onNewProject(...)` literally true. A forwarding wrapper would be ~40 lines of mechanical delegation whose only effect would be new places for a typo to hide.

The validation happens at construction rather than on first use, so a broken preload surfaces at startup with a clear message instead of as an undefined-property error inside some later click handler.

### 3. Totality over optional members

The contract requires every adapter to implement every member; a host that lacks a capability absorbs that internally. The obvious case is `menu.*`: Android has no native menu bar, so its adapter will implement all eight subscriptions as functions that register nothing and return a working unsubscribe.

The alternative — marking `menu` optional and having callers check — was rejected because it pushes the platform difference back up into shared code. Concretely, `App.tsx` has six `useEffect` blocks that each subscribe to a menu event and return the unsubscribe as cleanup. Under totality those six blocks run unmodified on both hosts. Under optionality every one of them grows a guard, and the mobile shell has to reproduce the same wiring with different code. Six no-op functions in one adapter is a far smaller cost than six conditionals in shared code, and it scales the right way as hosts are added.

### 4. Location identifiers are opaque above the adapter

`fs.saveProject` returns something the app stores as `project.filePath` and passes back as `existingPath` on the next save. On Electron that is a filesystem path; on Android it will be a document URI. Declaring it opaque now — round-trip it unmodified, never join or resolve it — means that difference stays entirely inside the adapter.

One carve-out is deliberate: `deriveProjectNameFromPath` in `src/store/index.ts` splits the identifier on `/` and `\` to show the project's name in the UI. That stays, as an explicitly best-effort *display* derivation. It never feeds back into addressing, so a URI that happens to derive an ugly label is a cosmetic issue on a host that does not exist yet, not a correctness one.

### 5. The module moves and is renamed

`src/lib/ipc-client.ts` becomes `src/lib/platform/contract.ts` (the contract, the registry, `AppSettings`) alongside `src/lib/platform/electronAdapter.ts`.

The name is worth the churn: "ipc-client" describes an Electron implementation detail, and there is no IPC at all in a WebView host — leaving that name in place would actively mislead the next person. The cost is eight mechanical import-line updates that `tsc` verifies exhaustively. No call expression changes.

## Risks / Trade-offs

- [A module calling `getEppApi()` at import time would now throw, since registration happens in the entry point] → Verified that none of the 27 call sites do this; all are inside effects, handlers, or async actions. If one is ever added, it fails immediately and loudly at startup with an explicit message rather than subtly.
- [Existing tests stub `window.eppAPI` directly — `installMockEppApi` in `src/store/index.test.ts` assigns a `globalThis.window`] → Those move to registering a fake adapter, which is simpler than the global they replace. This is a small, mechanical test change, and the resulting tests no longer need to fabricate a browser global at all.
- [The contract is frozen in shape by this change, and some members may turn out to fit Android badly] → Accepted deliberately. Reshaping the contract while also introducing the seam would make it impossible to tell a regression from an intended change. The mobile adapter change is the right place to discover which members need rethinking, with a working desktop implementation to diff against.
