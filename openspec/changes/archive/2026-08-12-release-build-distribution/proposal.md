## Why

Easy Photo Print has no way to produce or distribute an installable build today: `build:desktop` only emits unpacked `electron-vite` output (no installer), Android only ever produces a debug APK, and there is no version number anywhere in the repo. There is also no place to put a build once one exists — testing a change on another machine means manually copying files around. This change adds real packaging (installers, not raw build output) and a private, LAN-only distribution point on the user's home server, plus an on-demand skill to cut a release whenever the user decides one is ready — not on every merge to `main`.

## What Changes

- Add a `version` field to `package.json` and adopt semver for the project.
- Add `electron-builder` and configure it to produce: Linux `AppImage` + `deb` + `pacman` (`.pkg.tar.xz`) targets, and a Windows `nsis` installer (cross-built from Linux via `wine`).
- Add an Android release build path (`gradlew assembleRelease`) using a stable, unsigned/debug-keyed build suitable for personal LAN use (no Play Store distribution).
- Stand up a private build repository on the user's home server (`192.168.0.198`), reachable only from the local network: a versioned directory tree per platform, a pacman repository (`repo-add`) for native `pacman -S`/`-Syu` installs on Arch/CachyOS, and a lightweight static file server (autoindex, no reverse proxy) for Windows/Android downloads.
- Add a GitHub Actions workflow, triggered only by `workflow_dispatch`, running on a self-hosted runner living on the home server, that builds all three targets and publishes them to the build repository.
- Add a new Claude Code skill (e.g. `/cut-release`) that bumps the semver version, commits/pushes it, and dispatches the release workflow. This is explicitly **not** wired into `/opsx:archive` — cutting a release is a deliberate, separate action from archiving a change.

## Capabilities

### New Capabilities
- `release-packaging`: what it means for the app to have a versioned, installable release build for each supported platform (Linux desktop, Windows desktop, Android) — the artifact shapes, the versioning scheme, and the signing posture (unsigned/debug-keyed, LAN-only use).
- `build-distribution`: how a release becomes available to install — the private home-server repository (pacman repo for Arch, versioned directories for Windows/Android), its LAN-only access constraint, and the on-demand skill that triggers a release build/publish independent of the OpenSpec archive flow.

### Modified Capabilities
(none — no existing capability's requirements change)

## Impact

- `package.json`: new `version` field; new `electron-builder` devDependency and its config (likely `electron-builder.yml` or an `build` key in `package.json`).
- `android/`: release build type configuration (signing config, even if it's a stable debug-equivalent key).
- New GitHub Actions workflow file (e.g. `.github/workflows/release-build.yml`), `workflow_dispatch`-triggered, targeting a self-hosted runner.
- New Claude Code skill under `.claude/skills/` (or `.claude/commands/`, matching the existing `/deploy-to-phone` pattern) for cutting a release.
- One-time, out-of-band infrastructure setup on `192.168.0.198` (not part of this change's automated tasks, but documented in `design.md`): registering the self-hosted Actions runner, installing the Node/Android SDK/wine toolchain, creating `/srv/easyphotoprint`, and standing up the static file server container bound to a LAN-only port with a `ufw` rule.
- No impact on existing capabilities or their specs.
