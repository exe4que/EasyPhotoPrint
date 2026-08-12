---
name: "Cut Release"
description: "Bump the semver version and trigger a versioned build+publish to the private home-server build repository"
category: "Workflow"
tags: ["release", "build", "publish"]
---

Bump the project's semantic version and trigger a full release build (Linux, Windows, Android) that publishes to the private, LAN-only build repository on the home server (`192.168.0.198:8899`).

**Input**: Optional argument — `patch` (default), `minor`, or `major`, selecting which part of the semver version to bump.

## Versioning convention

- Default bump is `patch`. Use `minor`/`major` explicitly when the release includes a meaningful new capability or a breaking change, respectively.
- This is the **only** place version bumps happen. Archiving an OpenSpec change (`/opsx:archive`) merges to `main` on its own and never touches `version` — cutting a release is a separate, deliberate action from finishing a change. See `openspec/specs/build-distribution/spec.md`, "Release build is triggered on demand, independent of archiving".

## Steps

1. Read the current version from `package.json`.
2. Compute the new version for the requested bump type (patch/minor/major semver bump; default `patch`).
3. Update `package.json`'s `version` field to the new version.
4. Create a branch `release/vX.Y.Z` from an up-to-date `main`, commit the version bump (e.g. `Bump version to X.Y.Z for release`), and push it.
5. Open a PR with `gh pr create` and merge it with `gh pr merge` — standing authorization, no need to ask, mirroring the same commit/push/PR/merge authorization already granted for OpenSpec change work in `AGENTS.md` §3.1. Every change to `main`, including a version bump, goes through the same auditable PR path.
6. Once merged, run `gh workflow run release-build.yml --ref main -f version=X.Y.Z` to dispatch the release build on the self-hosted runner.
7. Look up and report the triggered run's URL (e.g. `gh run list --workflow=release-build.yml --limit 1 --json url,status,databaseId`) so progress/failure is visible without manual polling. Offer to `gh run watch <id>` if the user wants to follow it live.

## Guardrails

- Never invoke this automatically from `/opsx:archive`, `/opsx:apply`, or any other OpenSpec command — cutting a release is a deliberate, standalone action the user triggers explicitly, never a side effect of finishing a change.
- Don't dispatch the workflow before the version-bump PR has actually merged to `main` — the self-hosted runner builds whatever `main` currently is, so dispatching against a stale `main` would build the previous version's code under the new version number.
- If `gh workflow run` fails because the self-hosted runner is offline, report that clearly rather than retrying silently — it usually means the runner service on the home server needs attention, not something to work around from here.
