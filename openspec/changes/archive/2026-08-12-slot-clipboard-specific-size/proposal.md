## Why

Adversarial review of the just-archived `slot-clipboard` capability found a gap: `CopiedSlotProperties` captures `scalingRule` verbatim, including the value `'specificSize'`, but never captures the paired `specificSizeMm` dimensions that value requires. `packages/layout-engine/src/types.ts`'s `ImageSlotConfig.specificSizeMm` is documented as "only meaningful when scalingRule === 'specificSize'... always resolved (never partial)" — copying/pasting a `'specificSize'`-configured slot onto a target with no prior size produces exactly the partial state that invariant forbids, and the renderer doesn't handle it cleanly (it silently falls through to a full-bleed/stretched render instead of the intended `contain`-like fit). The user, presented with this gap, chose to close it by having the slot's specific-size dimensions travel with the rest of its copied properties, rather than degrading the scaling rule to `fitInParent` on copy.

## What Changes

- `CopiedSlotProperties` (the `slot-clipboard` capability's clipboard payload) gains the source slot's `specificSizeMm` (width/height/lockedAxis), captured alongside image assignment, scaling rule, rotation, and padding whenever the source's scaling rule is `specificSize`.
- Copy, Paste, Copy to siblings, and Copy to page all carry/apply this size data the same way they already carry the other four properties, so a `specificSize`-configured slot's exact size now transfers correctly instead of being dropped.
- When the source's scaling rule is not `specificSize`, there is no size to capture — unchanged from today.
- No change to what's shown in the UI or to any other scaling rule's behavior.

## Capabilities

### Modified Capabilities
- `slot-clipboard`: the "Copy Captures a Slot's Image, Scaling Rule, Rotation, and Padding" and "Paste Applies the Clipboard to the Selected Slot" requirements (and, by extension, "Copy to Siblings"/"Copy to Page") now include the slot's specific-size dimensions as part of what's captured and applied, when applicable.

## Impact

- `src/store/documentSlice.ts` — `CopiedSlotProperties`, `captureSlotProperties`, `applySlotPropertiesToNode`.
- No change to `template-schema` (project persistence) — the clipboard remains transient, in-memory, non-persisted state; this only changes what value snapshot it holds.
