## Why

Easy Photo Print ships with framework placeholder icons: the desktop builds show Electron's default icon (launcher, window, taskbar) and the Android APK shows Capacitor's default launcher icon. The app needs its own recognizable icon on every platform it's released for.

## What Changes

- New app icon: two stacked instant-style photo prints (the front one showing a sunset landscape) on a rounded-square cyan→indigo gradient — cyan being the app UI's existing accent.
- A single generator, `scripts/generate-icons.mjs`, writes the source SVGs into `build/icon/` and renders every variant from them (requires `rsvg-convert` and ImageMagick on the developer's machine; the rendered PNGs are committed, so release builds need neither):
  - `build/icons/<N>x<N>.png` (16–1024 px) — the Linux packages' hicolor icon sizes; `build/icon.png` (1024 px) — the Windows executable/installer icon (electron-builder converts it to `.ico`). Both set explicitly in `electron-builder.yml`, since electron-builder 26 didn't pick them up on its own ("default Electron icon is used").
  - `resources/icon.png` — set as the `BrowserWindow` icon (Linux window/taskbar) via electron-vite's `?asset` import, and added to electron-builder's `files` so it ships inside `app.asar`.
  - Android `mipmap-*` launcher icons: legacy square, round, and adaptive foreground/background layers; the adaptive icon's background switches from a flat white color to the gradient layer.
- No runtime behavior or UI changes beyond the icon.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `release-packaging`: ADDED requirement "Application icon".

## Impact

- New: `scripts/generate-icons.mjs`, `build/icon.png`, `build/icons/*.png`, `build/icon/*.svg`, `resources/icon.png`, `electron/main/env.d.ts` (electron-vite asset-import types).
- `electron/main/index.ts` — window `icon`.
- `electron-builder.yml` — `linux.icon`, `win.icon`, `resources/**` in `files`.
- `android/app/src/main/res/mipmap-*` PNGs and `mipmap-anydpi-v26/ic_launcher*.xml`.
