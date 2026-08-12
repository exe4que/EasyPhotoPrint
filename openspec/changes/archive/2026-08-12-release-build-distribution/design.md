## Context

See `proposal.md` for motivation. Relevant current state:

- `package.json` has no `version` field; `build:desktop` runs only `electron-vite build` (unpacked output, no installer); `build:android` runs `vite build` + `cap sync android` and produces no APK by itself. `.claude/commands/deploy-to-phone.md` shows the only existing packaged-artifact path today: `./gradlew assembleDebug` for a debug APK, installed via `adb`.
- The home server (`192.168.0.198`) runs CasaOS on top of Ubuntu 24.04, with ~20 Docker containers already running (Nextcloud, the *arr suite, Immich, etc.), Nginx Proxy Manager occupying ports 80/81/443, 12GB free RAM, 377GB free disk. The user's workstation is Arch-based (CachyOS).
- No CI currently exists in this repo (no `.github/workflows/`).

## Goals / Non-Goals

**Goals:**
- Produce real, installable artifacts (not raw build output) for Linux, Windows, and Android, each labeled with a semver version.
- Make those artifacts available from a repository that lives entirely inside the user's LAN, with `pacman` giving a native install/upgrade experience on the user's own machine.
- Trigger a release build/publish on demand via a Claude Code skill, decoupled from `/opsx:archive`.

**Non-Goals:**
- Public or internet-facing distribution, code signing, or Play Store / app store submission.
- CI on every push/PR (only `workflow_dispatch`, only for cutting a release).
- Automatic pruning/retention policy for old versions (disk is not a near-term constraint).
- A native "add repo" install experience for Android (F-Droid-style) — plain versioned APK downloads are sufficient since this wasn't required.

## Decisions

**Packaging tool: `electron-builder`.**
It is the standard packaging layer for Electron apps and natively supports all three desktop targets needed here (`AppImage`, `deb`, `pacman`), plus Windows `nsis` cross-built from Linux via `wine` — no hand-written PKGBUILD or NSIS script needed. Alternative considered: hand-rolled packaging scripts per platform — rejected as far more maintenance for no benefit over a well-supported existing tool.

**Build/publish trigger: on-demand skill → `workflow_dispatch` on a self-hosted GitHub Actions runner living on the home server**, not automatic on every push to `main`.
Three alternatives were weighed with the user:
1. *Push-to-`main` triggers the self-hosted runner automatically* (i.e., coupled to `/opsx:archive`, since archive ends in a merge to `main`). Rejected: the user does not want every archived change to produce a release build — cutting a release is a deliberate action, not a side effect of finishing a change.
2. *The skill builds locally* (same pattern as the existing `/deploy-to-phone` command) and `scp`/`rsync`s the result to the server, no runner involved. Rejected in favor of (3): it would add build-log tool-call overhead to whatever Claude Code session runs the skill, and ties every release to a machine that happens to have the full toolchain (Node, Android SDK, `wine`) installed and awake at that moment.
3. **Chosen**: the skill only bumps the version and fires `gh workflow run release-build.yml --ref main -f version=X.Y.Z` (`workflow_dispatch`). The actual build runs on a self-hosted GitHub Actions runner registered on the home server. This keeps the trigger explicit and cheap (a thin `gh` call, negligible tool-call/token overhead) while keeping the heavy build work off of interactive Claude Code sessions entirely. Self-hosted runner minutes are not billed by GitHub regardless of account tier (billing only applies to GitHub-hosted runners), so this works on a free GitHub account with a private repo.

**Versioning: manual semver in `package.json`, bumped by the release skill itself** (not by every `/opsx:archive`).
Because the trigger is now on-demand rather than per-archive, the version bump naturally happens once per release, at the moment the skill runs, rather than needing special-cased "should this archive bump the version" logic. Default bump type is `patch`; the skill accepts an argument to bump `minor`/`major` instead.

**Signing: unsigned Windows/Linux installers, stable debug-equivalent Android key.**
This is a personal, LAN-only distribution point, not a public release — paying for a code-signing certificate or going through Play Store review buys nothing here. The one thing that must hold is that the Android signing key stays **stable across builds** (Android refuses to install an update signed with a different key than the currently-installed one). Since the self-hosted runner always lives on the same machine, its `~/.android/debug.keystore` (or an explicit release keystore checked into the runner's persistent state, not the repo) stays constant across runs as long as the runner itself is never reprovisioned from scratch.

**Distribution server: no reverse proxy — a single static-file container bound directly to a fixed LAN port.**
Initially considered routing this through the existing Nginx Proxy Manager (matching how every other service on the home server is exposed), but NPM's value-add is TLS termination and friendly hostnames — neither is needed for an HTTP-only, IP:port, LAN-only repository. Decided instead: one lightweight container (e.g. `nginx:alpine` with `autoindex on`, or a purpose-built static-file-server image) bind-mounted to `/srv/easyphotoprint`, published directly as `192.168.0.198:8899`, with a `ufw` rule scoping that port to `192.168.0.0/24`. This is one fewer moving part and doesn't touch the NPM configuration used by the user's other services.

**Arch/pacman native install: `electron-builder`'s `pacman` target + `repo-add`, served unsigned (`SigLevel = Optional TrustAll`).**
This is what makes `pacman -S`/`-Syu` work natively on the user's own machine without a hand-written PKGBUILD. Repo signing with a personal GPG key was considered for integrity but rejected as unnecessary ceremony for a single-user, LAN-only repo — the relevant risk (a malicious actor already on the LAN able to serve a poisoned package) is accepted explicitly here rather than glossed over.

Two implementation details surfaced while verifying this locally (electron-builder actually run against this repo, not just read about): (1) the `pacman` target emits a `<name>-<version>.pacman` file — a valid xz-compressed pacman package despite the nonstandard extension — which the publish step renames to `<name>-<version>-<pkgrel>-<arch>.pkg.tar.xz` before `repo-add` will index it; (2) the pacman repository needs its own flat `arch/x86_64/` directory containing every package ever published (mirrored from the versioned `linux/vX.Y.Z/` tree), because pacman clients fetch package files by name from wherever `Server =` points, not from a human-browsable per-version path. `repo-add` is invoked against that flat directory. Ubuntu doesn't ship `repo-add` by default, but `pacman-package-manager` (apt, universe) does — confirmed available on the actual home server.

**Android distribution shape: plain versioned directory + `index.html`, not an F-Droid-style personal repo.**
The user did not ask for a native "add repo" experience on Android specifically (only for Arch/pacman), so the simpler option — a directory per version with the APK and a download page — was chosen over standing up `fdroidserver` and an index-v2 JSON feed. This can be revisited as a separate future change if wanted.

**Retention: keep every published version indefinitely.**
At an estimated 100–300MB per full release (three platforms) and 377GB free on the server, there is no near-term space pressure; adding pruning logic now would be solving a problem that doesn't exist yet.

## Risks / Trade-offs

- **[Runner reprovisioning breaks Android update-in-place]** → If the self-hosted runner's home directory is ever wiped/reprovisioned, its Android signing key changes, and every previously-installed release becomes un-upgradable in place (must uninstall first, losing local app data). Mitigation: `tasks.md` should include backing up the runner's keystore file outside the runner's own disk (e.g. into the build repository itself, access-restricted) so a reprovisioned runner can be restored to the same key.
- **[Unsigned pacman repo integrity]** → `SigLevel = Optional TrustAll` means pacman will install packages from this repo without verifying a signature. Acceptable given the repo is LAN-only and single-user, but worth the user's explicit awareness (already surfaced and accepted during exploration).
- **[Self-hosted runner resource contention]** → The build runner shares the home server with ~20 other Docker containers. A `wine`-based Windows cross-build plus an Android Gradle build plus `electron-builder`'s Linux targets is CPU/IO-heavy but infrequent (only on-demand, not per-commit), so contention is expected to be brief and rare rather than continuous.
- **[One-time server setup is manual, not automated by this change]** → Registering the GitHub Actions runner, installing Node/Android SDK/`wine`, creating `/srv/easyphotoprint`, and standing up the static-file container are hands-on, interactive steps done once against the user's real home server (sudo required for some of it) — they are documented here as a migration plan, not scripted as part of `tasks.md`'s automated implementation, since running unattended `sudo apt install`-style automation against a live homelab box is exactly the kind of action that warrants doing deliberately with the user present, not silently.
- **[Runner on a public repo]** → `exe4que/EasyPhotoPrint` is public, and self-hosted runners on public repos have a well-known attack surface (a fork's PR-triggered workflow could run arbitrary code on the runner). Mitigated here because the release workflow's only trigger is `workflow_dispatch`, which requires write access to the repo to invoke — a fork PR cannot reach it. Confirmed explicitly with the user before registering the runner rather than assumed.
- **[`ufw` is inactive server-wide]** → Discovered during setup: `ufw` is off for the whole server, not just unconfigured for port 8899 — every other service already on this box relies solely on the router not port-forwarding it, not on host firewalling. Enabling `ufw` now to gate just this one port would mean writing allow-rules for every other already-running service to avoid breaking something live. Confirmed with the user: left `ufw` off, matching the existing security posture, rather than take on that broader risk as a side effect of this change. Port 8899 has the same LAN-only guarantee (router-NAT-only) as everything else on this server.

## Migration Plan

One-time setup on `192.168.0.198` (interactive, sudo required for parts of this — not automated by `tasks.md`):
1. `sudo mkdir -p /srv/easyphotoprint/{linux,windows,android}` with appropriate ownership.
2. Install the self-hosted GitHub Actions runner (`actions-runner` package from the repo's Settings → Actions → Runners), register it against this repository, install it as a systemd service.
3. Install the runner's build toolchain: current-LTS Node.js (the server's system Node was an EOL 18.19.1, upgraded to 24.19.0 via NodeSource), a JDK (`openjdk-21-jdk-headless`, required by AGP 8.13 for the Android build — discovered missing during implementation, not anticipated at design time), the Android SDK + accepted licenses, `wine` **with 32-bit support** (`dpkg --add-architecture i386` + `wine32:i386` — Ubuntu's default `wine` package is 64-bit-only, but NSIS installers are 32-bit and electron-builder runs the just-built installer through wine once to compute an update block map, which needs real WoW64 support, not wine's experimental built-in one) plus `xvfb` (a fresh wine prefix needs a display to finish first-run initialization, which the headless runner doesn't have — the Windows packaging step runs under `xvfb-run -a`), `libarchive-tools` (provides `bsdtar` — electron-builder's `pacman` target shells out to `fpm`, which needs `bsdtar` to build the package's `.MTREE`; present by default on Arch, where this design was first verified, but not on Ubuntu — the first real end-to-end run against the runner failed with exit 127 until this was installed), and `pacman-package-manager` (apt, universe repo) for `repo-add`/`repo-remove` — confirmed available on this server (`archive.ubuntu.com/ubuntu noble/universe`) during implementation; it ships real `repo-add`, not just `pacman` itself, so no source build is needed.
4. Back up the runner's freshly-generated Android debug/release keystore to a safe location outside the runner's own disk (see Risks above).
5. Stand up the static-file container (`docker run -d -p 8899:80 -v /srv/easyphotoprint:/usr/share/nginx/html:ro ...` with autoindex on, or via CasaOS's custom-install UI) and add the `ufw` rule restricting port 8899 to `192.168.0.0/24`.
6. On the user's Arch/CachyOS machine, add the `[easyphotoprint]` repo block to `/etc/pacman.conf` pointing at `http://192.168.0.198:8899/arch/$arch`.

No rollback concerns beyond removing the runner registration and the container if the approach is abandoned — nothing here touches production app behavior for existing users, since there are none yet (personal/pre-release project).

## Open Questions

None remaining — the one open question from initial design (`/cut-release` building all three platforms vs. accepting a `--only` flag for a subset) was resolved during implementation: it always builds all three for this first version, matching `release-build.yml`'s single-job design. A per-platform flag can be added later as a separate change if needed.

## Implementation Notes

Not a design decision, but worth recording for future changes: a git process mistake surfaced during `task 7.1`'s verification. After PR #28 was squash-merged, a second fix was committed on the *same* already-merged local branch instead of a fresh branch off the new `main`. Because squash-merge rewrites commit SHAs, git's merge-base calculation for the follow-up PR got confused and silently excluded one file's change from that PR's diff (and thus from the merge) — the file still showed the old content on `main` after "successfully" merging. The fix each time after that: always `git fetch origin main && git checkout -b <new-branch> origin/main` fresh, never keep committing on a branch whose PR already squash-merged.
