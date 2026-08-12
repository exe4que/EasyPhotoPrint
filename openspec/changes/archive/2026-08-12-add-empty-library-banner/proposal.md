## Why

New users land on an empty project with no indication of what to do first. The app's core workflow (add images to the library, then place them into slots) isn't discoverable from the editor alone — the only existing hint is a small "No images loaded yet." placeholder inside the already-collapsed-looking Image Library panel itself, which a first-time user has no reason to look at yet.

## What Changes

- Add a full-width warning banner, shown directly above the page canvas on both the desktop and mobile shells, reading "Add images to library to start", visible whenever the image pool is empty and hidden as soon as the first image is added (reactive to library state, not a one-time/session flag — re-appears if the user later removes every image).
- No manual dismiss control — the banner is purely reactive to whether the library has images, per the user's explicit choice, to avoid a new user dismissing it before understanding what to do.
- Clicking the banner on desktop scrolls the Image Library panel into view (if needed) and plays a brief highlight/bounce animation on it to draw attention to where to act.
- Clicking the banner on mobile opens the Photos bottom sheet (the same as tapping the "Photos" tab in `BottomTabBar`) — the mobile shell has no permanently-visible Image Library panel to highlight, since it lives in a sheet.

## Capabilities

### New Capabilities
- `onboarding-banner`: a full-width warning banner, shown above the page canvas on both shells, that appears while the image library is empty and directs the user to the Image Library.

### Modified Capabilities
(none)

## Impact

- `src/components/shell/DesktopShell.tsx` — new banner rendered above `PageStage`; clicking it highlights the already-visible `ImageLibraryPanel`.
- `src/components/shell/MobileShell.tsx` — new banner rendered above `PageStage`; clicking it opens the existing `photos` bottom sheet tab (`setOpenTab('photos')`), the same as tapping the tab bar.
- New shared banner component (exact location decided in design.md).
- No store/schema changes — the banner reads existing `imagePool` state; no new persisted state.
