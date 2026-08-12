---
name: "Deploy to Phone"
description: "Build the Android app and install the debug APK on the connected test phone via adb"
category: "Workflow"
tags: ["android", "build", "deploy"]
---

Build and install the Android debug build on the physical test device.

**Input**: Optional argument — an adb device serial to install to, overriding the default (`f5ed1836`). Use `adb devices` to list connected serials if the default one isn't attached.

## Steps

1. Run `npm run build:android` from the repo root. This runs `vite build --config vite.mobile.config.ts && cap sync android` — it does not itself invoke Gradle, it only refreshes the web assets Gradle will bundle. If it fails, stop and report the build error; don't proceed.
2. From `./android`, run `./gradlew assembleDebug` to actually produce a fresh APK from the just-synced assets. This is what makes the install step reflect the current code instead of installing a stale APK left over from a previous build. If it fails, stop and report the Gradle error.
3. Confirm the APK at `./android/app/build/outputs/apk/debug/app-debug.apk` was just rewritten (its mtime should now be after step 1 started). If it's missing, say so and stop.
4. Run `adb -s <serial> install -r ./android/app/build/outputs/apk/debug/app-debug.apk`, using the serial from the argument if one was given, otherwise `f5ed1836`. `-r` reinstalls over an existing install (keeps app data) rather than failing on "already installed."
5. If `adb install` fails because the device isn't found, run `adb devices` and show the user the actual connected serials so they can pass the right one as an argument.

## Guardrails

- Don't skip the Gradle assemble step — installing a stale, previously-built APK defeats the point of this command.
- Don't reach for `sudo` or modify adb/USB debugging configuration on failure — just report what `adb` said.
