## 1. Icon source and generator

- [x] 1.1 Add `scripts/generate-icons.mjs`, which writes the icon's source SVGs to `build/icon/` and renders every desktop and Android variant from them.
- [x] 1.2 Generate and commit `build/icon.png`, `build/icons/*.png`, `resources/icon.png`, and the Android `mipmap-*` icons.

## 2. Wire up

- [x] 2.1 Set the main `BrowserWindow`'s `icon` from `resources/icon.png` (bundled via electron-vite's `?asset` import).
- [x] 2.2 Set `linux.icon`/`win.icon` in `electron-builder.yml` and ship `resources/**` in `files`.
- [x] 2.3 Point the Android adaptive icons' background at the generated gradient layer instead of the flat white color.

## 3. Verification

- [x] 3.1 Render a contact sheet of every variant (16–1024 px, adaptive under a circular mask) and check legibility and safe-zone fit. Legible down to 16 px; the adaptive foreground stays inside the circular mask.
- [x] 3.2 `npx electron-vite build` bundles the window icon; the app window shows it when launched. Launched under Xvfb: the window now has `_NET_WM_ICON` (absent on `main`), and the bundled path loads as a 512×512 image.
- [x] 3.3 `npm run build:desktop:release` produces Linux packages whose `.desktop` icon is the new icon. The `.pacman` and `.deb` install `hicolor/{16..1024}/apps/easy-photo-print.png`; `app.asar` contains `resources/icon.png`. Also `electron-builder --win --dir` (wine): the `.exe` embeds the new icon at 16–256 px.
- [x] 3.4 `npm run build:android` + `./gradlew assembleDebug` succeeds with the new launcher icons. The APK's `res/mipmap-*` entries match the generated PNGs byte for byte.
- [x] 3.5 `npm run typecheck` and `npm run test` pass (26 files, 226 tests).
