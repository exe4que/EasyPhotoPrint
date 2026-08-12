# release-packaging Specification

## Purpose

Defines what it means for Easy Photo Print to have a versioned, installable release build on each supported platform (Linux desktop, Windows desktop, Android), including the versioning scheme and the signing posture appropriate for personal, LAN-only distribution.

## Requirements

### Requirement: Project has a semantic version
The system SHALL declare a semantic version (MAJOR.MINOR.PATCH) in `package.json`, and this version SHALL be the source of truth used to label every packaged release artifact across platforms.

#### Scenario: Version bump produces distinctly versioned artifacts
- **WHEN** the project's semver version is bumped
- **THEN** each release artifact (Linux, Windows, Android) subsequently produced is labeled with that new version

### Requirement: Linux desktop release build
The system SHALL be able to produce installable Linux desktop packages in AppImage, Debian (`.deb`), and Arch (`.pkg.tar.xz`) formats from a single build invocation, each carrying the project's current semver version.

#### Scenario: Linux release build
- **WHEN** a Linux release build is produced for version X.Y.Z
- **THEN** the build output includes an AppImage, a `.deb` package, and a `.pkg.tar.xz` package, each named with X.Y.Z

### Requirement: Windows desktop release build
The system SHALL be able to produce a Windows NSIS installer from a Linux build environment, without requiring a Windows build machine, carrying the project's current semver version.

#### Scenario: Windows release build produced from Linux
- **WHEN** a Windows release build is produced for version X.Y.Z on a Linux build machine
- **THEN** the build output includes an NSIS installer executable named with X.Y.Z

### Requirement: Android release build
The system SHALL be able to produce a release-mode Android APK (not a debug build), not intended for Play Store distribution, that updates cleanly over prior installs produced by the same build environment.

#### Scenario: Android release build
- **WHEN** an Android release build is produced for version X.Y.Z
- **THEN** the build output is a release-mode APK named with X.Y.Z that installs via `adb install` or direct download

#### Scenario: Sequential Android releases update in place
- **WHEN** a second Android release build is produced on the same build environment as a prior one
- **THEN** installing the new APK over the prior one succeeds without uninstalling first, because both are signed with the same stable key

### Requirement: Release artifacts are unsigned for personal LAN use
Release artifacts SHALL NOT require a paid code-signing certificate or Play Store review. Windows and Linux installers SHALL be distributed unsigned; Android SHALL use a stable, non-Play-Store signing key. This posture is documented as unsuitable for public, internet-facing distribution.

#### Scenario: Installing an unsigned Windows build
- **WHEN** a user installs the Windows NSIS installer
- **THEN** Windows may show an unrecognized-publisher warning, and the system does not attempt to suppress or avoid that warning via paid signing
