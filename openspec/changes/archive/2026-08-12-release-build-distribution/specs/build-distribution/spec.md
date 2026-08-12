## Purpose

Defines how a packaged release becomes available to install: the private, LAN-only build repository on the user's home server, and the on-demand mechanism for triggering a release build/publish independent of the OpenSpec archive workflow.

## ADDED Requirements

### Requirement: Private LAN-only build repository
The system SHALL maintain a build repository on the user's home server that is reachable only from the local network, storing every published release version for Linux, Windows, and Android without automatic deletion of prior versions.

#### Scenario: Repository not reachable from outside the LAN
- **WHEN** a request for the build repository originates from outside the local network
- **THEN** the request does not reach the build repository

#### Scenario: Every published version remains available
- **WHEN** a new version is published
- **THEN** previously published versions remain downloadable at their own version-specific location

### Requirement: Native Arch/pacman installation
The system SHALL expose the Linux pacman packages as a valid pacman repository (with a `repo-add`-generated database) so an Arch Linux (or Arch-based) client can install and upgrade the application using `pacman` after adding the repository to `pacman.conf`.

#### Scenario: Installing via pacman
- **WHEN** a user has added the build repository to `pacman.conf` and runs `pacman -Sy <package>`
- **THEN** pacman installs the application from the repository without a manual file download

#### Scenario: Upgrading via pacman
- **WHEN** a new version is published to the repository
- **THEN** `pacman -Syu` on a client with the repository configured offers the new version as an upgrade

### Requirement: Release build is triggered on demand, independent of archiving
The system SHALL provide a way to trigger a versioned release build and publish it to the build repository on demand, and this trigger SHALL be independent of — never automatically invoked by — the OpenSpec archive workflow.

#### Scenario: Archiving a change does not trigger a release
- **WHEN** an OpenSpec change is archived (specs synced, merged to main)
- **THEN** no release build is triggered as a side effect of archiving

#### Scenario: Explicit trigger produces a release
- **WHEN** the release trigger is invoked
- **THEN** a new semver version is chosen, a build for all three platforms is produced, and the result is published to the build repository
